import test from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { CATEGORIES, catLabel, splitProducts, SELECT_EMPTY_HTML } from '../scripts/categories.mjs';

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
