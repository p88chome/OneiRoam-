import test from 'node:test';
import assert from 'node:assert';
import { computePricing } from '../supabase/functions/_shared/pricing.mjs';

test('單件：原價、訂金一半', () => {
  const r = computePricing([{ id: 'a', price: 1330, qty: 1 }]);
  assert.strictEqual(r.total, 1330);
  assert.strictEqual(r.deposit, 665);
  assert.strictEqual(r.freeShipping, false);
});
test('兩件以上：9折+免運', () => {
  const r = computePricing([{ id: 'a', price: 1000, qty: 1 }, { id: 'b', price: 1000, qty: 1 }]);
  assert.strictEqual(r.total, 1800);
  assert.strictEqual(r.freeShipping, true);
});
test('組合價：命中 bundle 用 flatPrice', () => {
  const items = [{ id: 'a', price: 980, qty: 1 }, { id: 'b', price: 980, qty: 1 },
                 { id: 'c', price: 1680, qty: 1 }, { id: 'd', price: 1680, qty: 1 }];
  const bundles = [{ id: 'all4', productIds: ['a','b','c','d'], flatPrice: 4320 }];
  const r = computePricing(items, { bundles });
  assert.strictEqual(r.total, 4320);
  assert.strictEqual(r.deposit, 2160);
});
