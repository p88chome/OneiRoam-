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

    const body = await req.json();
    const rawItems = Array.isArray(body.items) ? body.items : [];
    // 一律收全額（照商品頁面價格 / 折扣後合計）；不再區分訂金/尾款
    const amountType = 'full';
    if (!rawItems.length) return json({ error: '購物車是空的' }, 400);
    if (rawItems.length > 50) return json({ error: '品項過多' }, 400);

    // 同款同尺寸合併成一列再檢查庫存/限購（否則重複送同一列可繞過 max_qty 與庫存）
    const merged = new Map<string, { id: string; size: string; qty: number }>();
    for (const it of rawItems) {
      const id = typeof it?.id === 'string' ? it.id : '';
      const size = typeof it?.size === 'string' ? it.size : '';
      if (!id || !size) return json({ error: '商品資料錯誤' }, 400);
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
    if (cust.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cust.email)) return json({ error: 'Email 格式不正確' }, 400);

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
      if (price == null) return json({ error: `商品不存在：${it.id}` }, 400);
      const v = variants?.find(x => x.product_id === it.id && x.size === it.size);
      if (!v) return json({ error: `尺寸不存在：${it.id}/${it.size}` }, 400);
      const qty = it.qty;
      if (qty > v.stock) return json({ error: `庫存不足：${it.id}/${it.size}` }, 409);
      if (v.max_qty && qty > v.max_qty) return json({ error: `超過限購：${it.id}/${it.size}` }, 409);
      lineItems.push({ id: it.id, size: it.size, qty, price, name: buyable.find(p => p.id === it.id)!.name_zh });
    }

    // 防機器人（選填）：只有設定了 TURNSTILE_SECRET_KEY 才強制驗證，避免還沒申請 site key 前擋掉所有結帳
    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
    if (turnstileSecret) {
      const token = typeof body.turnstileToken === 'string' ? body.turnstileToken : '';
      if (!token) return json({ error: '請完成人機驗證' }, 400);
      const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: turnstileSecret, response: token }),
      }).then(r => r.json()).catch(() => ({ success: false }));
      if (!verify.success) return json({ error: '人機驗證失敗，請重新整理再試一次' }, 400);
    }

    const p = computePricing(lineItems.map(l => ({ id: l.id, price: l.price, qty: l.qty })));

    // 折扣碼（選填）：伺服器端驗證＋計算，客人送的折扣數字一律不信任。
    // 用量檢查＋遞增改走 claim_discount_code 原子 RPC（見 migration 0008），
    // 避免併發請求同時讀到舊的 used_count 而一起通過上限檢查。
    let discountCode: string | null = null;
    let codeDiscount = 0;
    const rawCode = typeof body.discount_code === 'string' ? body.discount_code.trim().toUpperCase() : '';
    if (rawCode) {
      const { data: claimed, error: claimErr } = await sb.rpc('claim_discount_code', { p_code: rawCode });
      if (claimErr) { console.error('claim_discount_code failed', claimErr); return json({ error: '折扣碼驗證失敗' }, 500); }
      const dc = Array.isArray(claimed) ? claimed[0] : claimed;
      if (!dc) {
        // 沒 claim 到：另外查一次現況只是為了給更友善的錯誤訊息，不影響安全判斷
        const { data: existing } = await sb.from('discount_codes')
          .select('active,expires_at,max_uses,used_count').eq('code', rawCode).maybeSingle();
        if (!existing || !existing.active) return json({ error: '折扣碼無效' }, 400);
        if (existing.expires_at && new Date(existing.expires_at) < new Date()) return json({ error: '折扣碼已過期' }, 400);
        return json({ error: '折扣碼已達使用上限' }, 400);
      }
      codeDiscount = dc.percent_off ? Math.round(p.total * dc.percent_off / 100) : (dc.amount_off || 0);
      codeDiscount = Math.min(codeDiscount, p.total);
      discountCode = rawCode;
    }
    const releaseCode = async () => {
      if (!discountCode) return;
      try { await sb.rpc('release_discount_code', { p_code: discountCode }); }
      catch (e) { console.error('release_discount_code failed', discountCode, e); }
    };
    const finalTotal = p.total - codeDiscount;
    const payAmount = amountType === 'full' ? finalTotal : Math.round(finalTotal / 2);
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
      user_id: userId, discount_code: discountCode,
    }).select('id').single();
    if (oErr) {
      console.error('order insert failed', no, oErr);
      await releaseCode();
      return json({ error: '建立訂單失敗，請稍後再試' }, 500);
    }
    const { error: iErr } = await sb.from('order_items').insert(lineItems.map(l => ({
      order_id: order.id, product_id: l.id, name: l.name, size: l.size, price: l.price, qty: l.qty,
    })));
    if (iErr) {
      console.error('order_items insert failed', no, iErr);
      await sb.from('orders').delete().eq('id', order.id);
      await releaseCode();
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
