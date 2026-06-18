const test = require('node:test');
const assert = require('node:assert');
const { computePricing } = require('../cart.js');

test('單件：原價、無折扣、訂金一半', () => {
  const r = computePricing([{ id: 'a', price: 1330, qty: 1 }]);
  assert.strictEqual(r.subtotal, 1330);
  assert.strictEqual(r.discount, 0);
  assert.strictEqual(r.total, 1330);
  assert.strictEqual(r.deposit, 665);
  assert.strictEqual(r.cod, 665);
  assert.strictEqual(r.freeShipping, false);
});

test('兩件以上：9折 + 免運', () => {
  const r = computePricing([
    { id: 'a', price: 1330, qty: 1 },
    { id: 'b', price: 1330, qty: 1 },
  ]);
  assert.strictEqual(r.subtotal, 2660);
  assert.strictEqual(r.total, 2394);          // 2660 * 0.9
  assert.strictEqual(r.discount, 266);
  assert.strictEqual(r.deposit, 1197);
  assert.strictEqual(r.cod, 1197);
  assert.strictEqual(r.freeShipping, true);
});

test('訂金四捨五入（奇數總額）', () => {
  const r = computePricing([{ id: 'a', price: 1335, qty: 1 }]);
  assert.strictEqual(r.deposit, 668);         // round(667.5)
  assert.strictEqual(r.cod, 667);
});

test('組合價：命中 bundle 用 flatPrice', () => {
  const r = computePricing(
    [
      { id: 'a', price: 1330, qty: 1 },
      { id: 'b', price: 1330, qty: 1 },
      { id: 'c', price: 1330, qty: 1 },
      { id: 'd', price: 1330, qty: 1 },
    ],
    { bundles: [{ productIds: ['a', 'b', 'c', 'd'], flatPrice: 4320 }] }
  );
  assert.strictEqual(r.subtotal, 5320);
  assert.strictEqual(r.total, 4320);
  assert.strictEqual(r.discount, 1000);
  assert.strictEqual(r.deposit, 2160);
});

test('bundle 未命中（缺一款）→ 走 9折', () => {
  const r = computePricing(
    [
      { id: 'a', price: 1330, qty: 1 },
      { id: 'b', price: 1330, qty: 1 },
      { id: 'c', price: 1330, qty: 1 },
    ],
    { bundles: [{ productIds: ['a', 'b', 'c', 'd'], flatPrice: 4320 }] }
  );
  assert.strictEqual(r.total, Math.round(3990 * 0.9)); // 3591
});

test('空車', () => {
  const r = computePricing([]);
  assert.strictEqual(r.subtotal, 0);
  assert.strictEqual(r.total, 0);
  assert.strictEqual(r.deposit, 0);
  assert.strictEqual(r.itemCount, 0);
});
