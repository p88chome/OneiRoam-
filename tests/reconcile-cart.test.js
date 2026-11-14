const test = require('node:test');
const assert = require('node:assert');
const { reconcileCart, createCart } = require('../cart.js');

const P = [
  { id: 'a', status: 'preorder', price: 1000, full_price: 3000 },
  { id: 'b', status: 'active', price: 500, full_price: null },
  { id: 'c', status: 'sold_out', price: 100 },
];
const V = [
  { product_id: 'a', size: 'F', stock: 1, max_qty: 1 },
  { product_id: 'b', size: 'M', stock: 0, max_qty: 2 },
  { product_id: 'b', size: 'L', stock: 5, max_qty: 2 },
];
const item = (id, size, extra = {}) => ({ id, name: id.toUpperCase(), size, price: id === 'a' ? 1000 : 500, qty: 1, ...extra });

test('reconcileCart: 正常品項保留，補上最新 maxQty / 全額', () => {
  const { items, notes } = reconcileCart([item('a', 'F')], P, V);
  assert.deepStrictEqual(notes, []);
  assert.strictEqual(items[0].maxQty, 1);
  assert.strictEqual(items[0].fullPrice, 3000);
});

test('reconcileCart: 下架 / 讀不到 / 尺寸不存在 / 售完 → 移除並說明', () => {
  const { items, notes } = reconcileCart(
    [item('c', 'F'), item('zz', 'F'), item('a', '自訂S'), item('b', 'M')], P, V);
  assert.deepStrictEqual(items, []);
  assert.deepStrictEqual(notes.map(n => n.reason), ['not_available', 'not_available', 'size_missing', 'sold_out']);
  assert.strictEqual(notes[2].size, '自訂S');
});

test('reconcileCart: 數量超過庫存/限購 → 調降；價格變動 → 更新', () => {
  const { items, notes } = reconcileCart([item('b', 'L', { qty: 4, price: 450 })], P, V);
  assert.strictEqual(items[0].qty, 2);
  assert.strictEqual(items[0].price, 500);
  assert.deepStrictEqual(notes.map(n => [n.reason, n.value]), [['qty_reduced', 2], ['price_changed', 500]]);
});

test('Cart.replace 寫回並正規化', () => {
  const store = {}; const storage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
  const cart = createCart(storage);
  cart.replace([{ id: 'a', name: 'A', size: 'F', price: '1000', qty: '2', maxQty: 1 }]);
  assert.deepStrictEqual(cart.getItems(), [{ id: 'a', name: 'A', size: 'F', price: 1000, qty: 2, maxQty: 1 }]);
});
