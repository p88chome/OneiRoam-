const test = require('node:test');
const assert = require('node:assert');
const { deletable, cancellable, parseTaipei } = require('../order-rules.js');

const NOW = new Date('2026-11-15T12:00:00Z'); // 台灣 20:00

test('付款失敗 / 已失效 → 可刪', () => {
  assert.ok(deletable({ payment_status: 'failed' }, NOW).ok);
  assert.ok(deletable({ payment_status: 'expired' }, NOW).ok);
});

test('已付款 → 不可刪、可取消；已取消就不能再取消', () => {
  assert.strictEqual(deletable({ payment_status: 'paid' }, NOW).ok, false);
  assert.ok(cancellable({ payment_status: 'paid', fulfillment_status: 'unfulfilled' }));
  assert.ok(cancellable({ payment_status: 'paid', fulfillment_status: 'shipped' }));
  assert.strictEqual(cancellable({ payment_status: 'paid', fulfillment_status: 'cancelled' }), false);
  assert.strictEqual(cancellable({ payment_status: 'pending', fulfillment_status: 'unfulfilled' }), false);
});

test('待付款、沒有繳費代碼 → 滿 1 小時才可刪', () => {
  assert.strictEqual(deletable({ payment_status: 'pending', created_at: '2026-11-15T11:30:00Z' }, NOW).ok, false);
  assert.ok(deletable({ payment_status: 'pending', created_at: '2026-11-15T10:30:00Z' }, NOW).ok);
});

test('待付款、有繳費代碼 → 過了繳費期限（台灣時間）才可刪', () => {
  const base = { payment_status: 'pending', pay_no: '12345', created_at: '2026-11-10T00:00:00Z' };
  // 台灣 2026-11-15 19:59:59 = UTC 11:59:59 → 已過期
  assert.ok(deletable({ ...base, pay_expire: '2026-11-15 19:59:59' }, NOW).ok);
  // 台灣 20:00:01 → 還沒到期
  assert.strictEqual(deletable({ ...base, pay_expire: '2026-11-15 20:00:01' }, NOW).ok, false);
  // 格式壞掉 → 不可刪
  assert.strictEqual(deletable({ ...base, pay_expire: 'tomorrow' }, NOW).ok, false);
  assert.strictEqual(deletable({ ...base, pay_expire: null }, NOW).ok, false);
});

test('parseTaipei 換算 UTC+8', () => {
  assert.strictEqual(parseTaipei('2026-11-15 08:00:00').toISOString(), '2026-11-15T00:00:00.000Z');
  assert.strictEqual(parseTaipei('bad'), null);
});
