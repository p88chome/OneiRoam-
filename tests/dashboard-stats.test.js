const test = require('node:test');
const assert = require('node:assert');
const { computeDashboardStats } = require('../dashboard-stats.js');

const products = [
  { id: 'a', name_zh: '甲', status: 'preorder' },
  { id: 'b', name_zh: '乙', status: 'preorder' },
  { id: 'c', name_zh: '丙', status: 'active' },
];
const variants = [
  { product_id: 'a', size: 'S', stock: 0 },
  { product_id: 'a', size: 'M', stock: 0 },   // a 全 0 → 售罄
  { product_id: 'b', size: 'S', stock: 2 },   // b 低庫存
  { product_id: 'b', size: 'M', stock: 20 },
  { product_id: 'c', size: 'F', stock: 1 },   // c 低庫存
];
const settings = { preorder_start: '2026-06-23', preorder_end: '2026-06-30' };

test('總數/預購中/售罄計數', () => {
  const r = computeDashboardStats(products, variants, settings, new Date('2026-06-25T08:00:00'));
  assert.strictEqual(r.total, 3);
  assert.strictEqual(r.preorder, 2);
  assert.strictEqual(r.soldOut, 1);            // 只有 a
});

test('低庫存：計數 + 明細升冪', () => {
  const r = computeDashboardStats(products, variants, settings, new Date('2026-06-25T08:00:00'));
  assert.strictEqual(r.lowStockCount, 2);      // b, c
  assert.deepStrictEqual(r.lowStockList, [
    { name: '丙', size: 'F', stock: 1 },
    { name: '乙', size: 'S', stock: 2 },
  ]);
});

test('預售窗口：open + daysLeft 含端點', () => {
  const r = computeDashboardStats(products, variants, settings, new Date('2026-06-30T08:00:00'));
  assert.strictEqual(r.window, 'open');
  assert.strictEqual(r.daysLeft, 1);           // 最後一天 = 剩 1 天
  const r2 = computeDashboardStats(products, variants, settings, new Date('2026-06-23T08:00:00'));
  assert.strictEqual(r2.daysLeft, 8);          // 6/23..6/30 含端點 = 8
});

test('預售窗口：before / after', () => {
  assert.strictEqual(computeDashboardStats(products, variants, settings, new Date('2026-06-20T08:00:00')).window, 'before');
  const after = computeDashboardStats(products, variants, settings, new Date('2026-07-01T08:00:00'));
  assert.strictEqual(after.window, 'after');
  assert.strictEqual(after.daysLeft, null);
});

test('空資料安全', () => {
  const r = computeDashboardStats([], [], {}, new Date('2026-06-25T08:00:00'));
  assert.strictEqual(r.total, 0);
  assert.strictEqual(r.soldOut, 0);
  assert.deepStrictEqual(r.lowStockList, []);
  assert.strictEqual(r.window, 'open');
  assert.strictEqual(r.daysLeft, null);
});
