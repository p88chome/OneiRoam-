// Cloudflare Worker：靜態資產只接受 GET/HEAD，但 PAYUNi 付款完成後
// 是用 POST 把瀏覽器導回 order-result.html（否則 405）。
// - 一般情況：把該 POST 303 轉成 GET（訂單編號在 query string 上）。
// - ATM / 超商代碼取號：POST body 裡有轉帳帳號 / 繳費代碼，303 會弄丟，客人就看不到帳號。
//   所以先把 body 交給 Supabase 的 payuni-return 驗章解密（HashKey 不放在 Cloudflare），
//   是取號成功就直接回傳填好帳號的結果頁（HTMLRewriter，setInnerContent 會跳脫，不吃 HTML）。
// 權威付款狀態仍由 payuni-notify（server-to-server）寫入；任何失敗都退回原本的 303。
const RETURN_FN = 'https://ywzsjhaqgidgxnjmyyeg.supabase.co/functions/v1/payuni-return';
// anon key 本來就公開（admin.config.js 也有），只用來通過 Edge Function 的 JWT 檢查
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3enNqaGFxZ2lkZ3huam15eWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNDYzMjUsImV4cCI6MjA5NzYyMjMyNX0.GVsWO45sxBxGg7H41Xi-2WEX7vfuNEFRDxp8UfEdUPc';

const text = s => ({ element(el) { el.setInnerContent(s); } });
const show = { element(el) { el.removeAttribute('data-hide'); } };

async function payCodePage(req, env, url) {
  const form = await req.formData();
  const r = await fetch(RETURN_FN, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY },
    body: form,
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) return null;
  const d = await r.json();
  const isAtm = d.paymentType === '2';
  if (!(d.ok && d.status === 'SUCCESS' && d.tradeStatus === '0' && d.payNo &&
        (isAtm || d.paymentType === '3'))) return null;

  // 資產層會把 *.html 307 到無副檔名網址，直接拿無副檔名版本
  const page = await env.ASSETS.fetch(new Request(new URL('/order-result', url)));
  if (!page.ok) return null;
  const res = new Response(page.body, page);
  res.headers.set('Cache-Control', 'no-store');

  let rw = new HTMLRewriter()
    .on('#resultTitle', text(isAtm ? '請完成 ATM 轉帳' : '請至超商繳費'))
    .on('#resultMsg', text(isAtm
      ? '訂單已成立，請於期限內轉帳至以下虛擬帳號，完成後訂單狀態會自動更新。'
      : '訂單已成立，請於期限內至超商以下列代碼繳費，完成後訂單狀態會自動更新。'))
    .on('#payInfo', show)
    .on('#payNoLabel', text(isAtm ? '轉帳帳號' : '繳費代碼'))
    .on('#payNo', text(d.payNo))
    .on('#payAmt', text(Number(d.tradeAmt || 0).toLocaleString('en-US')))
    .on('#payExpire', text(d.expireDate || '—'));
  if (d.orderNo) rw = rw.on('#orderNo', text(d.orderNo)).on('#orderNoLine', show);
  if (isAtm) rw = rw.on('#payBankLine', show).on('#payBank', text(d.bankType || '—'));
  return rw.transform(res);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'POST' && url.pathname === '/order-result.html') {
      try {
        const page = await payCodePage(req, env, url);
        if (page) return page;
      } catch (e) {
        console.error('pay code page failed', e);
      }
      return new Response(null, {
        status: 303,
        headers: { Location: url.pathname + url.search },
      });
    }
    return env.ASSETS.fetch(req);
  },
};
