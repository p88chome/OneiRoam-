import test from 'node:test';
import assert from 'node:assert';
import { renderProductPage } from '../scripts/product-pages.mjs';

const sample = {
  id: 'dress-white-lace', category: 'puff', price: 1690,
  name_zh: '花嫁之夢', name_en: 'Bridal Dream',
  desc_zh: '白色蕾絲歐根紗洋裝', desc_en: 'White lace organza dress',
  cat_zh: '澎袖', cat_en: 'Puff Sleeves',
  status: 'preorder', image: '/images/products/dress-white-lace.jpg',
  sizes: ['S', 'M', 'L', 'XL'], max_qty: 1,
};

test('renderProductPage: 標題／canonical／OG／JSON-LD 齊全', () => {
  const html = renderProductPage(sample);
  assert.match(html, /<title>花嫁之夢 — OneiRoam 夢遊<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.oneiroam\.com\/product-dress-white-lace\.html">/);
  assert.match(html, /"@type": "Product"/);
  assert.match(html, /"price": "1690"/);
  assert.match(html, /data-id="dress-white-lace"/);
  assert.match(html, /data-sizes="S,M,L,XL"/);
});

test('renderProductPage: 跳脫商品名避免破壞屬性', () => {
  const html = renderProductPage({ ...sample, name_zh: '雙"引號"款' });
  assert.match(html, /data-zh="雙&quot;引號&quot;款"/);
  assert.doesNotMatch(html, /雙"引號"款/);
});

test('renderProductPage: 沒圖 fallback favicon 當 og:image', () => {
  const html = renderProductPage({ ...sample, image: '' });
  assert.match(html, /og:image" content="https:\/\/www\.oneiroam\.com\/favicon\.svg"/);
});

test('renderProductPage: 初始隱藏用 class 不用行內 style（CSP style-src 無 unsafe-inline，行內 style 會被瀏覽器忽略）', () => {
  const html = renderProductPage(sample);
  assert.match(html, /id="pdSizeCustom" class="modal-size-custom js-hidden"/);
  assert.match(html, /id="pdAdded" class="modal-added js-hidden"/);
  assert.match(html, /id="pdCheckout" class="btn-primary modal-checkout js-hidden"/);
  // 這三個 id 本身不能再帶行內 style（cartBadge 等共用 header 元素不在本測試範圍內）
  for (const id of ['pdSizeCustom', 'pdAdded', 'pdCheckout']) {
    const tagMatch = html.match(new RegExp(`<[a-z]+ [^>]*id="${id}"[^>]*>`));
    assert.ok(tagMatch, `${id} tag not found`);
    assert.doesNotMatch(tagMatch[0], /style=/, `${id} should not use inline style`);
  }
});

test('renderProductPage: 絕對網址圖片（Supabase Storage）不重複補網域', () => {
  const html = renderProductPage({ ...sample, image: 'https://x.supabase.co/a.jpg' });
  assert.match(html, /og:image" content="https:\/\/x\.supabase\.co\/a\.jpg"/);
});
