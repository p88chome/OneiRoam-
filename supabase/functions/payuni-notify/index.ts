import { createClient } from 'jsr:@supabase/supabase-js@2';
import { verifyNotify } from '../_shared/payuni-crypto.mjs';

const ok200 = (msg = 'OK') => new Response(msg, { status: 200, headers: { 'Content-Type': 'text/plain' } });

// PAYUNi 成功/失敗判定：只可信任「內層」解密後欄位（verifyNotify 的 AES-GCM 認證僅涵蓋這段）。
// 外層 body.Status 未經 HashInfo/AES-GCM 驗證，任何人都能在重送時竄改，故一律禁止用於狀態決策。
// 下列欄位/數值為依官方文件的初步判斷，需以 Task 7 sandbox 實際回傳內容校準。
// calibrate against sandbox (Task 7)
function isPaid(inner: Record<string, string>): boolean {
  return inner.Status === 'SUCCESS' && String(inner.TradeStatus) === '1';
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
    // TEMP diagnostic (remove after isPaid/isFailed calibration): reveal real PAYUNi notify fields.
    console.log('PAYUNi notify DIAG inner=', JSON.stringify(inner), 'outerStatus=', body.Status);
    const no = inner.MerTradeNo;
    if (!no) { console.error('notify missing MerTradeNo'); return ok200(); }

    const { data: order } = await sb.from('orders').select('id,payment_status').eq('order_no', no).single();
    if (!order) { console.error('order not found', no); return ok200(); }

    if (isPaid(inner)) {
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
        return ok200();
      }
      if (!claimed || claimed.length === 0) {
        // 已被先前/同時的 notify 認領過，幂等略過，不重複扣庫存。
        return ok200();
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

      const w3 = Deno.env.get('WEB3FORMS_KEY');
      if (w3) {
        await fetch('https://api.web3forms.com/submit', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_key: w3, subject: `付款成功 ${no}`,
            order_no: no, amount: inner.TradeAmt, method: inner.PaymentType,
          }),
        }).catch(() => {});
      }
    } else if (isFailed(inner) && order.payment_status === 'pending') {
      // 明確失敗才標 failed；取號中（未付）維持 pending
      const { error: failErr } = await sb.from('orders').update({ payment_status: 'failed' })
        .eq('id', order.id)
        .eq('payment_status', 'pending');
      if (failErr) console.error('order failed-status update failed', no, failErr);
    }
    return ok200();
  } catch (e) {
    console.error('notify error', e);
    return ok200();
  }
});
