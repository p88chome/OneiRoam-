// preview-product.mjs — 商品卡欄位 → 卡內子選擇器、product key 解析、價格格式器。
// 供全頁預覽 harness 就地 patch 商品卡文字。放 repo 根以便瀏覽器 import（見 preview-render.mjs）。

// 相對於 .product-card 的子選擇器；對應 render-products.renderProductCards 的結構。
export const FIELD_SELECTORS = {
  name: '.product-name-link h3',
  desc: '.product-info > p',
  price: '.product-price',
  badge: '.product-badge',
};

// 右欄/patch 用的 product key（對 products 欄位）。
export const PRODUCT_KEYS = ['name_zh', 'name_en', 'desc_zh', 'desc_en', 'price', 'badge_zh', 'badge_en'];

// key → { field, lang }；price 無語言。未知 → null。
export function parseKey(key) {
  if (key === 'price') return { field: 'price', lang: null };
  const m = /^(name|desc|badge)_(zh|en)$/.exec(key);
  return m ? { field: m[1], lang: m[2] } : null;
}

// 與 render-products 的 fmt 一致：NT$ + 千分位；非數字 → 0。
export function priceText(price) {
  const n = Number(price);
  return `NT$ ${Number.isFinite(n) ? n.toLocaleString('en-US') : 0}`;
}
