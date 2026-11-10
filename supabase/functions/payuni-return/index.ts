import { createClient } from 'jsr:@supabase/supabase-js@2';
import { verifyNotify } from '../_shared/payuni-crypto.mjs';

// PAYUNi 前景返回（ReturnURL）解密。worker.js 收到 PAYUNi 導回 order-result.html 的 POST 後，
// 把 body 原樣轉來這裡；HashKey 只留在 Supabase，不進 Cloudflare。
// - 只回顯示用欄位（取號資訊），不改付款狀態：付款完成一律以 payuni-notify 為準。
// - ATM / 超商代碼取號成功時，把帳號/代碼存到訂單，店主後台可對帳。
// 欄位依 PAYUNi UPP 2.0 文件：TradeStatus 0=取號成功；PaymentType 2=ATM、3=超商代碼；
// BankType / PayNo / ExpireDate 為取號資訊。
Deno.serve(async (req) => {
  const json = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (req.method !== 'POST') return json({ ok: false }, 405);
  try {
    const form = await req.formData();
    const body: Record<string, string> = {};
    for (const [k, v] of form.entries()) body[k] = String(v);

    const res = verifyNotify(body, Deno.env.get('PAYUNI_HASH_KEY')!, Deno.env.get('PAYUNI_HASH_IV')!);
    if (!res.ok || !res.data) return json({ ok: false }, 400);
    const d = res.data as Record<string, string>;

    const out = {
      ok: true,
      orderNo: String(d.MerTradeNo || ''),
      status: String(d.Status || ''),
      tradeStatus: String(d.TradeStatus ?? ''),
      paymentType: String(d.PaymentType ?? ''),
      tradeAmt: String(d.TradeAmt || ''),
      bankType: String(d.BankType || ''),
      payNo: String(d.PayNo || ''),
      expireDate: String(d.ExpireDate || ''),
    };

    const isPayCode = out.status === 'SUCCESS' && out.tradeStatus === '0' && out.payNo &&
      (out.paymentType === '2' || out.paymentType === '3');
    if (isPayCode && out.orderNo) {
      const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { error } = await sb.from('orders')
        .update({ pay_bank: out.paymentType === '2' ? out.bankType : null, pay_no: out.payNo, pay_expire: out.expireDate })
        .eq('order_no', out.orderNo)
        .eq('payment_status', 'pending');
      if (error) console.error('pay code save failed', out.orderNo, error);
    }
    return json(out);
  } catch (e) {
    console.error('payuni-return error', e);
    return json({ ok: false }, 500);
  }
});
