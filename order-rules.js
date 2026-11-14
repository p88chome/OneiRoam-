/* order-rules.js — 後台訂單「可刪除 / 可取消」判斷。
   必須與 supabase/migrations/0016 的 public.order_deletable() 一致；資料庫才是真正的防線，
   這裡只決定後台顯示哪個按鈕。 */
(function (global) {
  const HOUR = 60 * 60 * 1000;

  // PAYUNi 繳費期限 'YYYY-MM-DD HH:MI:SS'（台灣時間 UTC+8）→ Date；格式不對回 null
  function parseTaipei(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(s || '');
    if (!m) return null;
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 8, +m[5], +m[6]));
  }

  // 回傳 { ok, reason }：ok=false 時 reason 給後台按鈕 tooltip
  function deletable(o, now = new Date()) {
    const st = o.payment_status;
    if (st === 'failed' || st === 'expired') return { ok: true, reason: '' };
    if (st === 'paid') return { ok: false, reason: '已付款訂單不可刪除，請改用「取消訂單」' };
    if (st === 'pending') {
      if (!o.pay_no) {
        const created = new Date(o.created_at);
        return now - created > HOUR
          ? { ok: true, reason: '' }
          : { ok: false, reason: '建立未滿 1 小時，客人可能還在付款' };
      }
      const exp = parseTaipei(o.pay_expire);
      if (!exp) return { ok: false, reason: '繳費期限不明，暫不可刪除' };
      return exp < now
        ? { ok: true, reason: '' }
        : { ok: false, reason: `繳費期限（${o.pay_expire}）內，客人仍可能付款` };
    }
    return { ok: false, reason: '未知狀態' };
  }

  function cancellable(o) {
    return o.payment_status === 'paid' && o.fulfillment_status !== 'cancelled';
  }

  const api = { deletable, cancellable, parseTaipei };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.orderRules = api;
})(typeof window !== 'undefined' ? window : globalThis);
