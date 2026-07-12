// Cloudflare Worker：靜態資產只接受 GET/HEAD，但 PAYUNi 付款完成後
// 是用 POST 把瀏覽器導回 order-result.html（否則 405）。
// 這裡把該 POST 303 轉成 GET：訂單編號在 query string 上；
// POST body 裡的結果不需要——權威付款狀態由 payuni-notify（server-to-server）寫入。
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'POST' && url.pathname === '/order-result.html') {
      return new Response(null, {
        status: 303,
        headers: { Location: url.pathname + url.search },
      });
    }
    return env.ASSETS.fetch(req);
  },
};
