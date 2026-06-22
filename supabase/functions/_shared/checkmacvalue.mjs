import { createHash, timingSafeEqual } from 'node:crypto';

// PHP urlencode 等價：encodeURIComponent + 手動補編碼 + 空格轉 +
function phpUrlencode(s) {
  return encodeURIComponent(String(s))
    .replace(/!/g, '%21').replace(/'/g, '%27').replace(/\(/g, '%28')
    .replace(/\)/g, '%29').replace(/\*/g, '%2A').replace(/%20/g, '+');
}

// CMV 專用 URL encode：phpUrlencode → ~轉%7E → 全小寫 → .NET 字元還原
function ecpayUrlEncode(s) {
  let e = phpUrlencode(s).replace(/~/g, '%7E').toLowerCase();
  const rep = [['%2d','-'],['%5f','_'],['%2e','.'],['%21','!'],['%2a','*'],['%28','('],['%29',')']];
  for (const [f, t] of rep) e = e.split(f).join(t);
  return e;
}

export function calcCheckMacValue(hashKey, hashIV, params, method) {
  const keys = Object.keys(params)
    .filter(k => k !== 'CheckMacValue')
    .sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0);
  const parts = keys.map(k => `${k}=${params[k]}`);
  const raw = `HashKey=${hashKey}&${parts.join('&')}&HashIV=${hashIV}`;
  const algo = (method || 'SHA256').toUpperCase() === 'MD5' ? 'md5' : 'sha256';
  return createHash(algo).update(ecpayUrlEncode(raw), 'utf8').digest('hex').toUpperCase();
}

export function verifyCheckMacValue(params, hashKey, hashIV, method) {
  if (!params || typeof params !== 'object') return false;
  const received = String(params.CheckMacValue || '').toUpperCase();
  const computed = calcCheckMacValue(hashKey, hashIV, params, method);
  if (received.length !== computed.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(computed));
}
