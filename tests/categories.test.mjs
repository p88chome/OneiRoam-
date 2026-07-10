import test from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { CATEGORIES, catLabel, splitProducts, SELECT_EMPTY_HTML, normalizeSlug, SELECT_TEASER_COUNT } from '../scripts/categories.mjs';

test('CATEGORIES: 七個分類、slug 順序固定', () => {
  assert.deepStrictEqual(
    CATEGORIES.map(c => c.slug),
    ['puff', 'collar', 'set', 'top', 'bottom', 'accessory', 'select']
  );
});

test('catLabel: 回傳中英標籤', () => {
  assert.deepStrictEqual(catLabel('puff'), ['澎袖', 'Puff Sleeves']);
  assert.deepStrictEqual(catLabel('select'), ['選品', 'Select Goods']);
  assert.deepStrictEqual(catLabel('top'), ['上衣', 'Tops']);
});

test('catLabel: 未知或舊分類 fallback 其他配件', () => {
  assert.deepStrictEqual(catLabel('dress'), ['其他配件', 'Accessories']);
  assert.deepStrictEqual(catLabel(undefined), ['其他配件', 'Accessories']);
});

test('splitProducts: select 分流，其餘歸原創', () => {
  const products = [
    { id: 'a', category: 'puff' },
    { id: 'b', category: 'select' },
    { id: 'c', category: 'dress' }, // 舊分類也算原創
  ];
  const { original, select } = splitProducts(products);
  assert.deepStrictEqual(original.map(p => p.id), ['a', 'c']);
  assert.deepStrictEqual(select.map(p => p.id), ['b']);
});

test('SELECT_EMPTY_HTML 與 index.html 靜態空狀態一致', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes(SELECT_EMPTY_HTML));
});

test('normalizeSlug: 已知 slug 原樣、未知/舊 slug 歸 accessory', () => {
  assert.strictEqual(normalizeSlug('puff'), 'puff');
  assert.strictEqual(normalizeSlug('select'), 'select');
  assert.strictEqual(normalizeSlug('dress'), 'accessory');
  assert.strictEqual(normalizeSlug(undefined), 'accessory');
});

test('SELECT_TEASER_COUNT: 首頁預告最多 4 件', () => {
  assert.strictEqual(SELECT_TEASER_COUNT, 4);
  const many = Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, category: 'select' }));
  assert.strictEqual(many.slice(0, SELECT_TEASER_COUNT).length, 4);
});
