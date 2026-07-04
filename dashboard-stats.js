(function (global) {
  function computeDashboardStats(products, variants, settings, now) {
    products = products || [];
    variants = variants || [];
    settings = settings || {};
    now = now || new Date();

    const total = products.length;
    const preorder = products.filter(p => p.status === 'preorder').length;

    let soldOut = 0;
    for (const p of products) {
      const vs = variants.filter(v => v.product_id === p.id);
      if (vs.length && vs.every(v => Number(v.stock) === 0)) soldOut++;
    }

    const low = variants.filter(v => Number(v.stock) > 0 && Number(v.stock) <= 3);
    const lowStockCount = new Set(low.map(v => v.product_id)).size;
    const lowStockList = low.map(v => {
      const p = products.find(pp => pp.id === v.product_id);
      return { name: p ? p.name_zh : v.product_id, size: v.size, stock: Number(v.stock) };
    }).sort((a, b) => a.stock - b.stock);

    const day = d => d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
    const today = day(now);
    const start = settings.preorder_start || '';
    const end = settings.preorder_end || '';
    let window = 'open', daysLeft = null;
    if (start && today < start) window = 'before';
    else if (end && today > end) window = 'after';
    else window = 'open';
    if (window === 'open' && end) {
      const ms = new Date(end + 'T00:00:00') - new Date(today + 'T00:00:00');
      daysLeft = Math.round(ms / 86400000) + 1;
    }

    return { total, preorder, soldOut, lowStockCount, lowStockList, window, daysLeft };
  }

  if (typeof window !== 'undefined') global.computeDashboardStats = computeDashboardStats;
  if (typeof module !== 'undefined' && module.exports) module.exports = { computeDashboardStats };
})(typeof window !== 'undefined' ? window : globalThis);
