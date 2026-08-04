import test from 'node:test';
import assert from 'node:assert';
import { renderProductCards, buildStorefrontData } from '../scripts/render-products.mjs';

const sample = {
  id: 'sea-gcd-short-jelly', category: 'top', price: 980,
  name_zh: '海的公因數 · 短袖水母', name_en: 'Sea GCD · Short Jellyfish',
  desc_zh: '🫧 印花透膚短袖上衣，水母圖案。', desc_en: 'Sheer short top.',
  badge_zh: '印花透膚', badge_en: 'Sheer Print', cat_zh: '上衣', cat_en: 'Top',
  status: 'preorder', image: '/images/products/sea-gcd-jelly.jpg',
  sizes: ['小碼', '大碼'], max_qty: 1,
};

test('renderProductCards: 含關鍵 data 屬性與價格格式', () => {
  const html = renderProductCards([sample]);
  assert.match(html, /data-id="sea-gcd-short-jelly"/);
  assert.match(html, /data-sizes="小碼,大碼"/);
  assert.match(html, /data-max-qty="1"/);
  assert.match(html, /data-modal-name-zh="海的公因數 · 短袖水母"/);
  assert.match(html, /NT\$ 980/);
  assert.match(html, /class="product-card"/);
});

test('renderProductCards: 千分位格式', () => {
  const html = renderProductCards([{ ...sample, price: 1680 }]);
  assert.match(html, /NT\$ 1,680/);
});

test('renderProductCards: sold_out 狀態顯示售罄', () => {
  const html = renderProductCards([{ ...sample, status: 'sold_out' }]);
  assert.match(html, /status-soldout/);
  assert.match(html, /售罄/);
});

test('renderProductCards: 徽章留白不輸出空框；英文留白 fallback 中文', () => {
  const none = renderProductCards([{ ...sample, badge_zh: '', badge_en: '' }]);
  assert.doesNotMatch(none, /product-badge/);
  const zhOnly = renderProductCards([{ ...sample, badge_zh: '新品', badge_en: '' }]);
  assert.match(zhOnly, /data-zh="新品" data-en="新品"/);
});

test('renderProductCards: 沒圖不輸出 img，卡片留漸層底', () => {
  const html = renderProductCards([{ ...sample, image: '' }]);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /data-modal-img=""/);
  assert.match(html, /product-img-wrap/);
});

test('renderProductCards: 跳脫引號避免破壞屬性', () => {
  const html = renderProductCards([{ ...sample, name_zh: '雙"引號"款' }]);
  assert.match(html, /data-modal-name-zh="雙&quot;引號&quot;款"/);
});

test('renderProductCards: 商品名連到獨立頁 product-{id}.html', () => {
  const html = renderProductCards([sample]);
  assert.match(html, /<a href="product-sea-gcd-short-jelly\.html" class="product-name-link"><h3/);
});

test('buildStorefrontData: 解析設定', () => {
  const data = buildStorefrontData({
    deposit_rate: '0.5', bank_name: '玉山銀行', bank_code: '808',
    bank_account: '0831976040688', bank_holder: '王小明',
    preorder_start: '2026-06-23', preorder_end: '2026-06-30',
  });
  assert.strictEqual(data.deposit_rate, 0.5);
  assert.strictEqual(data.bank.holder, '王小明');
  assert.strictEqual(data.preorder.start, '2026-06-23');
});
