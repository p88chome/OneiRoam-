const test = require('node:test');
const assert = require('node:assert');
const { createCart, makeOrderNo } = require('../cart.js');

function memStorage() {
  let store = {};
  return {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
}

test('addItem 新增一筆', () => {
  const cart = createCart(memStorage());
  cart.addItem({ id: 'a', name: '花嫁之夢', price: 1690, size: 'M', qty: 1 });
  assert.deepStrictEqual(cart.getItems(), [
    { id: 'a', name: '花嫁之夢', price: 1690, size: 'M', qty: 1 },
  ]);
});

test('同 id+size 再加 → qty 累加，不新增列', () => {
  const cart = createCart(memStorage());
  cart.addItem({ id: 'a', name: 'X', price: 100, size: 'M', qty: 1 });
  cart.addItem({ id: 'a', name: 'X', price: 100, size: 'M', qty: 2 });
  assert.strictEqual(cart.getItems().length, 1);
  assert.strictEqual(cart.getItems()[0].qty, 3);
});

test('不同 size 視為不同列', () => {
  const cart = createCart(memStorage());
  cart.addItem({ id: 'a', name: 'X', price: 100, size: 'M', qty: 1 });
  cart.addItem({ id: 'a', name: 'X', price: 100, size: 'L', qty: 1 });
  assert.strictEqual(cart.getItems().length, 2);
});

test('updateQty 改數量；設 0 移除該列', () => {
  const cart = createCart(memStorage());
  cart.addItem({ id: 'a', name: 'X', price: 100, size: 'M', qty: 1 });
  cart.updateQty('a', 'M', 5);
  assert.strictEqual(cart.getItems()[0].qty, 5);
  cart.updateQty('a', 'M', 0);
  assert.strictEqual(cart.getItems().length, 0);
});

test('updateSize 改尺寸', () => {
  const cart = createCart(memStorage());
  cart.addItem({ id: 'a', name: 'X', price: 100, size: 'M', qty: 1 });
  cart.updateSize('a', 'M', 'XL');
  assert.strictEqual(cart.getItems()[0].size, 'XL');
});

test('remove 刪除指定列', () => {
  const cart = createCart(memStorage());
  cart.addItem({ id: 'a', name: 'X', price: 100, size: 'M', qty: 1 });
  cart.remove('a', 'M');
  assert.strictEqual(cart.getItems().length, 0);
});

test('count 為所有 qty 總和', () => {
  const cart = createCart(memStorage());
  cart.addItem({ id: 'a', name: 'X', price: 100, size: 'M', qty: 2 });
  cart.addItem({ id: 'b', name: 'Y', price: 50, size: 'F', qty: 3 });
  assert.strictEqual(cart.count(), 5);
});

test('total 為 price*qty 總和', () => {
  const cart = createCart(memStorage());
  cart.addItem({ id: 'a', name: 'X', price: 100, size: 'M', qty: 2 });
  cart.addItem({ id: 'b', name: 'Y', price: 50, size: 'F', qty: 3 });
  assert.strictEqual(cart.total(), 350);
});

test('clear 清空', () => {
  const cart = createCart(memStorage());
  cart.addItem({ id: 'a', name: 'X', price: 100, size: 'M', qty: 1 });
  cart.clear();
  assert.strictEqual(cart.getItems().length, 0);
});

test('持久化：第二個 cart 實例讀到同 storage 資料', () => {
  const s = memStorage();
  const c1 = createCart(s);
  c1.addItem({ id: 'a', name: 'X', price: 100, size: 'M', qty: 1 });
  const c2 = createCart(s);
  assert.strictEqual(c2.getItems().length, 1);
});

test('壞掉的 JSON 不爆，回空陣列', () => {
  const s = memStorage();
  s.setItem('oneiRoamCart', '{not json');
  const cart = createCart(s);
  assert.deepStrictEqual(cart.getItems(), []);
});

test('訂單編號格式 OR-YYYYMMDD-XXX', () => {
  const no = makeOrderNo(new Date('2026-06-15T10:00:00'));
  assert.match(no, /^OR-20260615-[0-9A-Z]{3}$/);
});

test('連續產生不重複（機率）', () => {
  const d = new Date('2026-06-15T10:00:00');
  const set = new Set(Array.from({ length: 50 }, () => makeOrderNo(d)));
  assert.ok(set.size > 45);
});

test('addItem 受 maxQty 上限夾擠', () => {
  const cart = createCart(memStorage());
  cart.addItem({ id: 'a', name: 'X', price: 100, size: 'M', qty: 1, maxQty: 1 });
  cart.addItem({ id: 'a', name: 'X', price: 100, size: 'M', qty: 3, maxQty: 1 });
  assert.strictEqual(cart.getItems()[0].qty, 1);
});
