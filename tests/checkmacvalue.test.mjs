import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { calcCheckMacValue, verifyCheckMacValue } from '../supabase/functions/_shared/checkmacvalue.mjs';

const vectors = JSON.parse(readFileSync(new URL('./fixtures/ecpay-checkmacvalue.json', import.meta.url))).vectors;

for (const v of vectors) {
  if (v.formula === 'ecticket' || !v.params || !v.expected) continue; // 只測標準 CMV（含 SHA256/MD5）
  test(`CMV vector: ${v.name}`, () => {
    const got = calcCheckMacValue(v.hashKey, v.hashIV, v.params, v.method);
    assert.strictEqual(got, v.expected);
  });
}

test('verifyCheckMacValue: 正確簽章通過、竄改不過', () => {
  const hashKey = 'pwFHCqoQZGmho4w6', hashIV = 'EkRm7iFT261dpevs';
  const params = { MerchantID: '3002607', MerchantTradeNo: 'Test1234567890', TotalAmount: '100' };
  const mac = calcCheckMacValue(hashKey, hashIV, params, 'SHA256');
  assert.strictEqual(verifyCheckMacValue({ ...params, CheckMacValue: mac }, hashKey, hashIV, 'SHA256'), true);
  assert.strictEqual(verifyCheckMacValue({ ...params, TotalAmount: '999', CheckMacValue: mac }, hashKey, hashIV, 'SHA256'), false);
});
