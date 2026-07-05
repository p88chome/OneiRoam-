import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildEncryptInfo, buildHashInfo } from '../_shared/payuni-crypto.mjs';
import { computePricing } from '../_shared/pricing.mjs';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const UPP = (env: string) => env === 'prod'
  ? 'https://api.payuni.com.tw/api/upp'
  : 'https://sandbox-api.payuni.com.tw/api/upp';

function orderNo() {
  return ('OR' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).toUpperCase().slice(0, 20);
}

// Return-page base picked from the request Origin (staging vs production auto-follow),
// validated against an allowlist so the post-payment redirect can't be pointed at a
// phishing host. Covers www.oneiroam.com and every *.oneiroam.workers.dev preview/alias.
function pickReturnBase(origin: string, fallback: string): string {
  try {
    const u = new URL(origin);
    if (u.protocol === 'https:' && (
      u.hostname === 'www.oneiroam.com' ||
      u.hostname === 'oneiroam.com' ||
      u.hostname.endsWith('.oneiroam.workers.dev')
    )) return `${u.protocol}//${u.host}`;
  } catch { /* invalid/absent Origin → fallback */ }
  return fallback;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  try {
    const env = Deno.env.get('PAYUNI_ENV') || 'sandbox';
    const merId = Deno.env.get('PAYUNI_MER_ID')!;
    const hashKey = Deno.env.get('PAYUNI_HASH_KEY')!;
    const hashIV = Deno.env.get('PAYUNI_HASH_IV')!;
    const version = Deno.env.get('PAYUNI_VERSION') || '2.0';
    const site = Deno.env.get('SITE_URL') || 'https://www.oneiroam.com';
    const supaUrl = Deno.env.get('SUPABASE_URL')!;
    // Supabase auto-injects the service role key as SUPABASE_SERVICE_ROLE_KEY
    // (the SUPABASE_ prefix is reserved — you cannot set SUPABASE_SERVICE_KEY yourself).
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Validate required secrets before any DB write
    if (!merId || !hashKey || !hashIV || !supaUrl || !serviceKey) {
      return json({ error: 'server misconfigured' }, 500);
    }

    const sb = createClient(supaUrl, serviceKey);

    const body = await req.json();
    const reqItems = Array.isArray(body.items) ? body.items : [];
    const amountType = body.amount_type === 'full' ? 'full' : 'deposit';
    if (!reqItems.length) return json({ error: '購物車是空的' }, 400);

    // 伺服器重算：讀現價 + 庫存
    const ids = [...new Set(reqItems.map((i: any) => i.id))];
    const { data: products, error: pErr } = await sb.from('products').select('id,name_zh,price').in('id', ids);
    if (pErr) return json({ error: '讀取商品資料失敗' }, 500);
    const { data: variants, error: vErr } = await sb.from('product_variants').select('product_id,size,stock,max_qty').in('product_id', ids);
    if (vErr) return json({ error: '讀取商品資料失敗' }, 500);
    const priceOf = (id: string) => products?.find(p => p.id === id)?.price ?? null;

    const lineItems: any[] = [];
    for (const it of reqItems) {
      const price = priceOf(it.id);
      if (price == null) return json({ error: `商品不存在：${it.id}` }, 400);
      const v = variants?.find(x => x.product_id === it.id && x.size === it.size);
      if (!v) return json({ error: `尺寸不存在：${it.id}/${it.size}` }, 400);
      const qty = Math.max(1, parseInt(it.qty, 10) || 1);
      if (qty > v.stock) return json({ error: `庫存不足：${it.id}/${it.size}` }, 409);
      if (v.max_qty && qty > v.max_qty) return json({ error: `超過限購：${it.id}/${it.size}` }, 409);
      lineItems.push({ id: it.id, size: it.size, qty, price, name: products!.find(p => p.id === it.id)!.name_zh });
    }

    const p = computePricing(lineItems.map(l => ({ id: l.id, price: l.price, qty: l.qty })));
    const payAmount = amountType === 'full' ? p.total : p.deposit;
    const no = orderNo();

    // 寫訂單（pending）
    const c = body.customer || {};
    const { data: order, error: oErr } = await sb.from('orders').insert({
      order_no: no, name: c.name || '', phone: c.phone || '', social: c.social || '',
      email: c.email || '', notes: c.notes || '', amount_type: amountType,
      subtotal: p.subtotal, discount: p.discount, total: p.total, pay_amount: payAmount,
    }).select('id').single();
    if (oErr) return json({ error: oErr.message }, 500);
    const { error: iErr } = await sb.from('order_items').insert(lineItems.map(l => ({
      order_id: order.id, product_id: l.id, name: l.name, size: l.size, price: l.price, qty: l.qty,
    })));
    if (iErr) return json({ error: iErr.message }, 500);

    // PAYUNi UPP 加密參數
    const productName = lineItems.map(l => `${l.name} x${l.qty}`).join('、').slice(0, 60);
    const inner: Record<string, string> = {
      MerID: merId,
      MerTradeNo: no,
      TradeAmt: String(payAmount),
      ProductName: productName,
      Timestamp: String(Math.floor(Date.now() / 1000)),
      ReturnURL: `${pickReturnBase(req.headers.get('origin') || '', site)}/order-result.html`,
      NotifyURL: `${supaUrl}/functions/v1/payuni-notify`,
    };
    const encryptInfo = buildEncryptInfo(inner, hashKey, hashIV);
    const hashInfo = buildHashInfo(encryptInfo, hashKey, hashIV);

    return json({
      action: UPP(env),
      params: { MerID: merId, Version: version, EncryptInfo: encryptInfo, HashInfo: hashInfo },
    });
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
