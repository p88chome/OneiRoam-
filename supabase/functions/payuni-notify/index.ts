import { createClient } from 'jsr:@supabase/supabase-js@2';
import { verifyNotify } from '../_shared/payuni-crypto.mjs';

const ok200 = (msg = 'OK') => new Response(msg, { status: 200, headers: { 'Content-Type': 'text/plain' } });
// 驗章已通過但我方 DB 讀寫失敗 → 回 500 讓 PAYUNi 重送（流程冪等，重送安全）。
// 回 200 會讓 PAYUNi 以為送達，已付款的訂單就永遠卡在待付款。
const retry500 = () => new Response('retry', { status: 500, headers: { 'Content-Type': 'text/plain' } });

// 已付款卻找不到訂單（例如被刪掉）→ 寄信給店主人工處理，不能只留 log
async function alertOwner(subject: string, fields: Record<string, unknown>) {
  const w3 = Deno.env.get('WEB3FORMS_KEY');
  if (!w3) return;
  await fetch('https://api.web3forms.com/submit', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_key: w3, subject, ...fields }),
  }).catch(() => {});
}

// PAYUNi 成功/失敗判定：只可信任「內層」解密後欄位（verifyNotify 的 AES-GCM 認證僅涵蓋這段）。
// 外層 body.Status 未經 HashInfo/AES-GCM 驗證，任何人都能在重送時竄改，故一律禁止用於狀態決策。
// 下列欄位/數值為依官方文件的初步判斷，需以 Task 7 sandbox 實際回傳內容校準。
// calibrate against sandbox (Task 7)
function isPaid(inner: Record<string, string>): boolean {
  return inner.Status === 'SUCCESS' && String(inner.TradeStatus) === '1';
}

// ATM / 超商代碼過期未繳：PAYUNi「訂單失效通知」TradeStatus 固定為 4
function isExpired(inner: Record<string, string>): boolean {
  return String(inner.TradeStatus) === '4';
}

// ATM / 超商取號成功（尚未付款）：TradeStatus 0 且帶繳費代碼。
// 平常由 payuni-return（客人瀏覽器導回）寫入；若 PAYUNi 也送取號通知，這裡補寫，
// 客人取號後直接關頁面也不會漏記代碼。
function isPayCode(inner: Record<string, string>): boolean {
  return inner.Status === 'SUCCESS' && String(inner.TradeStatus) === '0' && !!inner.PayNo &&
    (String(inner.PaymentType) === '2' || String(inner.PaymentType) === '3');
}

// calibrate against sandbox (Task 7)
function isFailed(inner: Record<string, string>): boolean {
  // 明確失敗才成立；取號中／處理中（無 Status 或 Status===SUCCESS 但未付）不算失敗，維持 pending。
  return !!inner.Status && inner.Status !== 'SUCCESS';
}

Deno.serve(async (req) => {
  try {
    const hashKey = Deno.env.get('PAYUNI_HASH_KEY')!;
    const hashIV = Deno.env.get('PAYUNI_HASH_IV')!;
    // Supabase auto-injects the service role key as SUPABASE_SERVICE_ROLE_KEY.
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const form = await req.formData();
    const body: Record<string, string> = {};
    for (const [k, v] of form.entries()) body[k] = String(v);

    // 先驗 HashInfo + 解密；不符 → 記錄、回 200、不動資料
    const res = verifyNotify(body, hashKey, hashIV);
    if (!res.ok || !res.data) {
      console.error('PAYUNi notify verify failed', body.MerTradeNo || '(no MerTradeNo)');
      return ok200();
    }
    const inner = res.data as Record<string, string>;
    const no = inner.MerTradeNo;
    if (!no) { console.error('notify missing MerTradeNo'); return ok200(); }

    const { data: order, error: orderErr } = await sb.from('orders').select('id,payment_status,pay_amount,discount_code,discount_counted').eq('order_no', no).maybeSingle();
    if (orderErr) { console.error('order lookup failed', no, orderErr); return retry500(); }
    if (!order) {
      console.error('order not found', no);
      if (isPaid(inner)) {
        await alertOwner(`⚠ 收到付款但找不到訂單 ${no}`, {
          order_no: no, amount: inner.TradeAmt, method: inner.PaymentType, trade_no: inner.TradeNo,
          message: 'PAYUNi 通知此筆已付款，但資料庫查無訂單（可能已被刪除）。請到 PAYUNi 後台核對並聯絡客人。',
        });
      }
      return ok200();
    }

    if (isPaid(inner)) {
      // 縱深防禦：金額與商店代號必須和我方訂單一致，不符不標已付款，改人工核對
      const merId = Deno.env.get('PAYUNI_MER_ID');
      const amtOk = Number(inner.TradeAmt) === Number(order.pay_amount);
      const merOk = !merId || !inner.MerID || inner.MerID === merId;
      if (!amtOk || !merOk) {
        console.error('PAYUNi notify mismatch', no, { tradeAmt: inner.TradeAmt, payAmount: order.pay_amount, merOk });
        await sb.from('orders').update({ needs_review: true }).eq('id', order.id);
        return ok200();
      }
      // 原子「認領」：只有 pending→paid 這個 row-level 條件更新會成功且恰好一次；
      // 併發/重送的 notify 若晚到，這裡 affected rows 會是 0，直接視為已處理（幂等），不再扣庫存。
      const { data: claimed, error: claimErr } = await sb
        .from('orders')
        .update({
          payment_status: 'paid',
          gateway_trade_no: inner.TradeNo || '',
          payment_method: inner.PaymentType || '',
          paid_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .eq('payment_status', 'pending')
        .select('id');

      if (claimErr) {
        console.error('order claim update failed', no, claimErr);
        return retry500();
      }
      if (!claimed || claimed.length === 0) {
        // 已被先前/同時的 notify 認領過，幂等略過，不重複扣庫存。
        return ok200();
      }

      // 折扣碼用量在付款成功這一刻才 +1（只會跑一次：上面的 pending→paid 認領已保證幂等）。
      // discount_counted=true 代表下單時已算過（0011 之前的舊訂單），不重複計。
      if (order.discount_code && !order.discount_counted) {
        const { data: withinLimit, error: dcErr } = await sb.rpc('count_discount_use', { p_code: order.discount_code });
        if (dcErr) console.error('count_discount_use failed', no, dcErr);
        else await sb.from('orders').update({ discount_counted: true }).eq('id', order.id);
        if (dcErr || withinLimit !== true) {
          // 計數失敗、碼已刪除，或多張 pending 同時付款超過上限 → 店主人工判斷
          const { error: reviewErr } = await sb.from('orders').update({ needs_review: true }).eq('id', order.id);
          if (reviewErr) console.error('needs_review update failed', no, reviewErr);
        }
      }

      const { data: stockOk, error: rpcErr } = await sb.rpc('decrement_stock', { p_order_id: order.id });
      if (rpcErr) {
        // RPC 本身失敗 ≠ 庫存不足；扣庫存並未執行，需要人工核對。
        console.error('decrement_stock rpc failed', no, rpcErr);
        const { error: reviewErr } = await sb.from('orders').update({ needs_review: true }).eq('id', order.id);
        if (reviewErr) console.error('needs_review update failed', no, reviewErr);
      } else if (stockOk === false) {
        const { error: reviewErr } = await sb.from('orders').update({ needs_review: true }).eq('id', order.id);
        if (reviewErr) console.error('needs_review update failed', no, reviewErr);
      }

      await alertOwner(`付款成功 ${no}`, { order_no: no, amount: inner.TradeAmt, method: inner.PaymentType });
    } else if (isPayCode(inner)) {
      const { error: codeErr } = await sb.from('orders')
        .update({ pay_bank: String(inner.PaymentType) === '2' ? String(inner.BankType || '') : null,
                  pay_no: String(inner.PayNo), pay_expire: String(inner.ExpireDate || '') })
        .eq('id', order.id)
        .eq('payment_status', 'pending');
      if (codeErr) { console.error('pay code save failed', no, codeErr); return retry500(); }
    } else if (isExpired(inner)) {
      // 只有仍在待付款的才標失效；已付款的不動
      const { error: expErr } = await sb.from('orders').update({ payment_status: 'expired' })
        .eq('id', order.id)
        .eq('payment_status', 'pending');
      if (expErr) { console.error('order expired-status update failed', no, expErr); return retry500(); }
    } else if (isFailed(inner) && order.payment_status === 'pending') {
      // 明確失敗才標 failed；取號中（未付）維持 pending
      const { error: failErr } = await sb.from('orders').update({ payment_status: 'failed' })
        .eq('id', order.id)
        .eq('payment_status', 'pending');
      if (failErr) { console.error('order failed-status update failed', no, failErr); return retry500(); }
    }
    return ok200();
  } catch (e) {
    console.error('notify error', e);
    return retry500();
  }
});
