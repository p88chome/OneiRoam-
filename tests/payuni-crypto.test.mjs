import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  httpBuildQuery, buildEncryptInfo, buildHashInfo, decryptInfo, verifyNotify,
} from '../supabase/functions/_shared/payuni-crypto.mjs';

const v = JSON.parse(readFileSync(new URL('./fixtures/payuni-crypto.json', import.meta.url)));

test('KAT: buildEncryptInfo 對拍固定向量（Node/Python 已驗證一致）', () => {
  assert.strictEqual(buildEncryptInfo(v.params, v.key, v.iv), v.EncryptInfo);
});

test('KAT: buildHashInfo 對拍固定向量', () => {
  assert.strictEqual(buildHashInfo(v.EncryptInfo, v.key, v.iv), v.HashInfo);
});

test('round-trip: encrypt → decrypt 還原一致', () => {
  const enc = buildEncryptInfo(v.params, v.key, v.iv);
  assert.deepStrictEqual(decryptInfo(enc, v.key, v.iv), v.params);
});

test('httpBuildQuery: 空格→+、中文與符號 URL 編碼', () => {
  assert.strictEqual(httpBuildQuery({ a: 'x y', b: '夢' }), 'a=x+y&b=%E5%A4%A2');
});

test('verifyNotify: 合法通過並回傳解密資料、竄改 HashInfo 不過', () => {
  const params = { MerTradeNo: 'OR123ABC', TradeStatus: 'SUCCESS' };
  const enc = buildEncryptInfo(params, v.key, v.iv);
  const hash = buildHashInfo(enc, v.key, v.iv);
  const good = verifyNotify({ EncryptInfo: enc, HashInfo: hash }, v.key, v.iv);
  assert.strictEqual(good.ok, true);
  assert.deepStrictEqual(good.data, params);
  const bad = verifyNotify({ EncryptInfo: enc, HashInfo: hash.slice(0, -1) + '0' }, v.key, v.iv);
  assert.strictEqual(bad.ok, false);
  assert.strictEqual(bad.data, null);
});
