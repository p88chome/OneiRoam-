import test from 'node:test';
import assert from 'node:assert';
import { FIELD_SELECTORS, PRODUCT_KEYS, parseKey, priceText } from '../preview-product.mjs';

test('preview-product: field selectors match real card structure', () => {
  assert.deepStrictEqual(FIELD_SELECTORS, {
    name: '.product-name-link h3', desc: '.product-info > p',
    price: '.product-price', badge: '.product-badge',
  });
});

test('preview-product: product keys', () => {
  assert.deepStrictEqual(PRODUCT_KEYS,
    ['name_zh', 'name_en', 'desc_zh', 'desc_en', 'price', 'badge_zh', 'badge_en']);
});

test('preview-product: parseKey splits field/lang', () => {
  assert.deepStrictEqual(parseKey('name_zh'), { field: 'name', lang: 'zh' });
  assert.deepStrictEqual(parseKey('badge_en'), { field: 'badge', lang: 'en' });
  assert.deepStrictEqual(parseKey('price'), { field: 'price', lang: null });
  assert.strictEqual(parseKey('bogus'), null);
});

test('preview-product: priceText formats NT$ + thousands, non-number -> 0', () => {
  assert.strictEqual(priceText(1690), 'NT$ 1,690');
  assert.strictEqual(priceText('1690'), 'NT$ 1,690');
  assert.strictEqual(priceText(''), 'NT$ 0');
  assert.strictEqual(priceText('abc'), 'NT$ 0');
});
