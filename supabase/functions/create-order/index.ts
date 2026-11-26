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
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Validate required secrets before any DB write
    if (!merId || !hashKey || !hashIV || !supaUrl || !serviceKey) {
      return json({ error: 'server misconfigured' }, 500);
    }

    const sb = createClient(supaUrl, serviceKey);
    // 4xx 一律記原因（Supabase function logs 查得到），並回傳 code 讓前端顯示具體訊息
    const reject = (status: number, code: string, error: string, extra: Record<string, unknown> = {}) => {
      console.warn('create-order rejected', JSON.stringify({ code, error, ...extra }));
      return json({ error, code, ...extra }, status);
    };

    const body = await req.json();
    const rawItems = Array.isArray(body.items) ? body.items : [];
    // 一律收全額（照商品頁面價格 / 折扣後合計）；不再區分訂金/尾款
    const amountType = 'full';
    if (!rawItems.length) return reject(400, 'empty_cart', '購物車是空的');
    if (rawItems.length > 50) return reject(400, 'too_many_items', '品項過多');

    // 同款同尺寸合併成一列再檢查庫存/限購（否則重複送同一列可繞過 max_qty 與庫存）
    const merged = new Map<string, { id: string; size: string; qty: number }>();
    for (const it of rawItems) {
      const id = typeof it?.id === 'string' ? it.id : '';
      const size = typeof it?.size === 'string' ? it.size : '';
      if (!id || !size) return reject(400, 'bad_item', '商品資料錯誤');
      const qty = Math.max(1, parseInt(it.qty, 10) || 1);
      const k = JSON.stringify([id, size]);
      const prev = merged.get(k);
      if (prev) prev.qty += qty; else merged.set(k, { id, size, qty });
    }
    const reqItems = [...merged.values()];

    // 客人欄位：強制字串＋長度上限（在認領折扣碼之前驗，失敗不會佔用額度）
    const c = body.customer && typeof body.customer === 'object' ? body.customer : {};
    const field = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    const cust = {
      name: field(c.name, 50), phone: field(c.phone, 30), social: field(c.social, 100),
      email: field(c.email, 254), notes: field(c.notes, 1000),
    };
    if (cust.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cust.email)) return reject(400, 'bad_email', 'Email 格式不正確');

    // 人機驗證放在第一次查資料庫之前：沒過驗證的請求不會消耗 DB 查詢（前端每次失敗都會重置 token）
    // 防機器人（選填）：只有設定了 TURNSTILE_SECRET_KEY 才強制驗證，避免還沒申請 site key 前擋掉所有結帳
    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
    if (turnstileSecret) {
      const token = typeof body.turnstileToken === 'string' ? body.turnstileToken : '';
      if (!token) return reject(400, 'turnstile_missing', '請完成人機驗證');
      if (token.length > 2048) return reject(400, 'turnstile_failed', '人機驗證失敗，請重新整理再試一次');
      // 驗證結果必須來自我們的網域、而且是結帳這個動作（防止別站的 token 拿來用）。
      // 正式環境不可含 localhost；本機測試可用 TURNSTILE_HOSTNAMES 覆寫。
      const hostnames = new Set((Deno.env.get('TURNSTILE_HOSTNAMES') || 'oneiroam.com,www.oneiroam.com')
        .split(',').map(h => h.trim()).filter(Boolean));
      const remoteip = req.headers.get('cf-connecting-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
      const params = new URLSearchParams({ secret: turnstileSecret, response: token });
      if (remoteip) params.set('remoteip', remoteip);
      const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: AbortSignal.timeout(10_000),
        body: params,
      }).then(r => (r.ok ? r.json() : { success: false })).catch(() => ({ success: false }));
      if (!verify.success || verify.action !== 'checkout' || !hostnames.has(verify.hostname)) {
        console.error('turnstile rejected', { success: verify.success, action: verify.action, hostname: verify.hostname, codes: verify['error-codes'] });
        return reject(400, 'turnstile_failed', '人機驗證失敗，請重新整理再試一次');
      }
    }

    // 伺服器重算：讀現價 + 庫存
    const ids = [...new Set(reqItems.map((i: any) => i.id))];
    const { data: products, error: pErr } = await sb.from('products').select('id,name_zh,price,status').in('id', ids);
    if (pErr) return json({ error: '讀取商品資料失敗' }, 500);
    const { data: variants, error: vErr } = await sb.from('product_variants').select('product_id,size,stock,max_qty').in('product_id', ids);
    if (vErr) return json({ error: '讀取商品資料失敗' }, 500);
    // 只有上架中（preorder / active）的商品能下單；hidden / sold_out 一律視為不存在
    const buyable = (products || []).filter(p => p.status === 'preorder' || p.status === 'active');
    const priceOf = (id: string) => buyable.find(p => p.id === id)?.price ?? null;

    const lineItems: any[] = [];
    for (const it of reqItems) {
      const price = priceOf(it.id);
      if (price == null) return reject(400, 'not_available', '商品已下架或暫停販售', { item: { id: it.id, size: it.size } });
      const v = variants?.find(x => x.product_id === it.id && x.size === it.size);
      if (!v) return reject(400, 'size_missing', '商品尺寸已更新，請重新選擇', { item: { id: it.id, size: it.size } });
      const qty = it.qty;
      if (qty > v.stock) return reject(409, 'out_of_stock', '庫存不足', { item: { id: it.id, size: it.size }, available: Math.max(0, v.stock) });
      if (v.max_qty && qty > v.max_qty) return reject(409, 'over_limit', '超過每人限購數量', { item: { id: it.id, size: it.size }, available: v.max_qty });
      lineItems.push({ id: it.id, size: it.size, qty, price, name: buyable.find(p => p.id === it.id)!.name_zh });
    }

    // 自動優惠（2 件 9 折 / 組合價）已停用；折扣只剩折扣碼。threshold=Infinity → total = subtotal
    const p = computePricing(lineItems.map(l => ({ id: l.id, price: l.price, qty: l.qty })), { discountThreshold: Infinity });

    // 折扣碼（選填）：伺服器端驗證＋計算，客人送的折扣數字一律不信任。
    // 這裡只驗證、不計用量：用量在 payuni-notify 付款成功時才 +1（migration 0011），
    // 避免只下單不付款就耗光限量碼。
    let discountCode: string | null = null;
    let codeDiscount = 0;
    const rawCode = typeof body.discount_code === 'string' ? body.discount_code.trim().toUpperCase() : '';
    if (rawCode) {
      const { data: dc, error: dcErr } = await sb.from('discount_codes')
        .select('active,expires_at,max_uses,used_count,percent_off,amount_off').eq('code', rawCode).maybeSingle();
      if (dcErr) { console.error('discount lookup failed', dcErr); return json({ error: '折扣碼驗證失敗' }, 500); }
      if (!dc || !dc.active) return reject(400, 'discount_invalid', '折扣碼無效');
      if (dc.expires_at && new Date(dc.expires_at) < new Date()) return reject(400, 'discount_expired', '折扣碼已過期');
      if (dc.max_uses != null && dc.used_count >= dc.max_uses) return reject(400, 'discount_used_up', '折扣碼已達使用上限');
      codeDiscount = dc.percent_off ? Math.round(p.total * dc.percent_off / 100) : (dc.amount_off || 0);
      codeDiscount = Math.min(codeDiscount, p.total);
      discountCode = rawCode;
    }
    const finalTotal = p.total - codeDiscount;
    const payAmount = amountType === 'full' ? finalTotal : Math.round(finalTotal / 2);
    // 0 元（例如 100% 折扣碼）送 PAYUNi 會失敗，只會留下一筆永遠待付款的單
    if (payAmount < 1) return reject(400, 'zero_amount', '折扣後金額需至少 NT$1，此折扣碼無法用於這筆訂單');
    const no = orderNo();

    // 帶使用者 token 就把訂單掛帳號；anon key / 無效 token = 訪客結帳（null）
    let userId: string | null = null;
    try {
      const userClient = createClient(supaUrl, anonKey, {
        global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id ?? null;
    } catch { /* 訪客結帳 */ }

    // 寫訂單（pending）
    const { data: order, error: oErr } = await sb.from('orders').insert({
      order_no: no, name: cust.name, phone: cust.phone, social: cust.social,
      email: cust.email, notes: cust.notes, amount_type: amountType,
      subtotal: p.subtotal, discount: p.discount + codeDiscount, total: finalTotal, pay_amount: payAmount,
      user_id: userId, discount_code: discountCode, discount_counted: false,
    }).select('id').single();
    if (oErr) {
      console.error('order insert failed', no, oErr);
      return json({ error: '建立訂單失敗，請稍後再試' }, 500);
    }
    const { error: iErr } = await sb.from('order_items').insert(lineItems.map(l => ({
      order_id: order.id, product_id: l.id, name: l.name, size: l.size, price: l.price, qty: l.qty,
    })));
    if (iErr) {
      console.error('order_items insert failed', no, iErr);
      await sb.from('orders').delete().eq('id', order.id);
      return json({ error: '建立訂單失敗，請稍後再試' }, 500);
    }

    // PAYUNi UPP 加密參數
    const productName = lineItems.map(l => `${l.name} x${l.qty}`).join('、').slice(0, 60);
    const inner: Record<string, string> = {
      MerID: merId,
      MerTradeNo: no,
      TradeAmt: String(payAmount),
      ProductName: productName,
      Timestamp: String(Math.floor(Date.now() / 1000)),
      ReturnURL: `${pickReturnBase(req.headers.get('origin') || '', site)}/order-result.html?order_no=${no}`,
      NotifyURL: `${supaUrl}/functions/v1/payuni-notify`,
      // 帶入客人 Email：PAYUNi 付款頁預填，ATM / 超商代碼取號資訊也會寄到這個信箱
      ...(cust.email ? { UsrMail: cust.email } : {}),
    };
    const encryptInfo = buildEncryptInfo(inner, hashKey, hashIV);
    const hashInfo = buildHashInfo(encryptInfo, hashKey, hashIV);

    return json({
      action: UPP(env),
      params: { MerID: merId, Version: version, EncryptInfo: encryptInfo, HashInfo: hashInfo },
    });
  } catch (e: any) {
    console.error('create-order error', e);
    return json({ error: '建立訂單失敗，請稍後再試' }, 500);
  }
});
