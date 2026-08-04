// 分類單一來源。改分類只改這裡＋admin.js 的 CATEGORY_OPTIONS（瀏覽器端無法 import 此檔）。
export const CATEGORIES = [
  { slug: 'puff',          zh: '澎袖',       en: 'Puff Sleeves' },
  { slug: 'collar',        zh: '領片',       en: 'Collars' },
  { slug: 'set',           zh: '套裝',       en: 'Sets' },
  { slug: 'top',           zh: '上衣',       en: 'Tops' },
  { slug: 'bottom',        zh: '下著',       en: 'Bottoms' },
  { slug: 'accessory',     zh: '其他配件',   en: 'Accessories' },
  // 選品＝主理人選來賣的別牌商品，有自己的子分類
  { slug: 'select_top',    zh: '選品・上衣', en: 'Select · Tops' },
  { slug: 'select_bottom', zh: '選品・下著', en: 'Select · Bottoms' },
  { slug: 'select_acc',    zh: '選品・配件', en: 'Select · Accessories' },
];

const FALLBACK = ['其他配件', 'Accessories'];
const LEGACY_SELECT = ['選品', 'Select Goods'];  // 舊資料的單一 select 分類

// select 開頭的 slug（含舊制 'select'）都屬於選品區
export function isSelect(slug) {
  return typeof slug === 'string' && slug.startsWith('select');
}

export function catLabel(slug) {
  const c = CATEGORIES.find(c => c.slug === slug);
  if (c) return [c.zh, c.en];
  return slug === 'select' ? LEGACY_SELECT : FALLBACK;
}

// 未遷移/未知 slug 一律視為其他配件，確保 data-category、tag class、篩選互相一致
// （舊制 'select' 保留原樣，仍歸選品區）
export function normalizeSlug(slug) {
  if (slug === 'select') return slug;
  return CATEGORIES.some(c => c.slug === slug) ? slug : 'accessory';
}

// 選品獨立成區，其餘（含未遷移的舊分類）都進原創設計區
export function splitProducts(products) {
  return {
    original: products.filter(p => !isSelect(p.category)),
    select:   products.filter(p => isSelect(p.category)),
  };
}

// 選品區空狀態（需與 index.html 靜態內容一字不差，build 覆寫時才無 diff 噪音）
export const SELECT_EMPTY_HTML =
  '<p class="select-empty" data-zh="選物即將上架，敬請期待 ✦" data-en="Select goods coming soon ✦">選物即將上架，敬請期待 ✦</p>';

// 首頁選物預告區最多顯示幾件；完整列表在 select.html
export const SELECT_TEASER_COUNT = 4;
