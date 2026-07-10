// 分類單一來源。改分類只改這裡＋admin.js 的 CATEGORY_OPTIONS（瀏覽器端無法 import 此檔）。
export const CATEGORIES = [
  { slug: 'puff',      zh: '澎袖',     en: 'Puff Sleeves' },
  { slug: 'collar',    zh: '領片',     en: 'Collars' },
  { slug: 'set',       zh: '套裝',     en: 'Sets' },
  { slug: 'top',       zh: '上衣',     en: 'Tops' },
  { slug: 'bottom',    zh: '下著',     en: 'Bottoms' },
  { slug: 'accessory', zh: '其他配件', en: 'Accessories' },
  { slug: 'select',    zh: '選品',     en: 'Select Goods' },
];

const FALLBACK = ['其他配件', 'Accessories'];

export function catLabel(slug) {
  const c = CATEGORIES.find(c => c.slug === slug);
  return c ? [c.zh, c.en] : FALLBACK;
}

// 選品獨立成區，其餘（含未遷移的舊分類）都進原創設計區
export function splitProducts(products) {
  return {
    original: products.filter(p => p.category !== 'select'),
    select:   products.filter(p => p.category === 'select'),
  };
}
