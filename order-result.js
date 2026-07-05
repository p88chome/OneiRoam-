// 付款結果頁：只顯示 URL 帶回的訂單編號（純 UX）。
// 資安：狀態不信任瀏覽器導回（真狀態由 notify 寫 DB）；order_no 先驗格式再以
// textContent 寫入（防 XSS），不符合格式一律不顯示。
(() => {
  const no = new URLSearchParams(location.search).get('order_no') || '';
  if (/^[A-Z0-9]{6,20}$/.test(no)) {
    document.getElementById('orderNo').textContent = no;
    document.getElementById('orderNoLine').style.display = '';
  }
})();
