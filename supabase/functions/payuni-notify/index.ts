import { createClient } from 'jsr:@supabase/supabase-js@2';
import { verifyNotify } from '../_shared/payuni-crypto.mjs';

const ok200 = (msg = 'OK') => new Response(msg, { status: 200, headers: { 'Content-Type': 'text/plain' } });

// PAYUNi 成功判定：外層 Status 與內層 TradeStatus 的成功值以官方文件確認。
// 依 SDK 慣例：外層 Status==='SUCCESS' 代表「請求處理成功」；付款結果看內層 TradeStatus==='1'（付款成功）。
function isPaid(outerStatus: string, inner: Record<string, string>): boolean {
  return outerStatus === 'SUCCESS' && String(inner.TradeStatus) === '1';
}

Deno.serve(async (req) => {
  try {
    const hashKey = Deno.env.get('PAYUNI_HASH_KEY')!;
    const hashIV = Deno.env.get('PAYUNI_HASH_IV')!;
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_KEY')!);

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

    const { data: order } = await sb.from('orders').select('id,payment_status').eq('order_no', no).single();
    if (!order) { console.error('order not found', no); return ok200(); }

    if (isPaid(body.Status || '', inner) && order.payment_status !== 'paid') {
      const { data: stockOk } = await sb.rpc('decrement_stock', { p_order_id: order.id });
      await sb.from('orders').update({
        payment_status: 'paid',
        gateway_trade_no: inner.TradeNo || '',
        payment_method: inner.PaymentType || '',
        paid_at: new Date().toISOString(),
        needs_review: stockOk === false,
      }).eq('id', order.id);

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
    } else if (body.Status && body.Status !== 'SUCCESS' && order.payment_status === 'pending') {
      // 明確失敗才標 failed；取號中（Status=SUCCESS 但未付）維持 pending
      await sb.from('orders').update({ payment_status: 'failed' }).eq('id', order.id);
    }
    return ok200();
  } catch (e) {
    console.error('notify error', e);
    return ok200();
  }
});
