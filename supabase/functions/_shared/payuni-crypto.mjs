import { createCipheriv, createDecipheriv, createHash, timingSafeEqual } from 'node:crypto';

// PHP http_build_query 等價：alnum 與 -_. 不編碼；空格→+；其餘 %XX 大寫；~→%7E
function phpUrlencode(s) {
  return encodeURIComponent(String(s))
    .replace(/[!'()*~]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, '+');
}
export function httpBuildQuery(obj) {
  return Object.entries(obj)
    .map(([k, val]) => `${phpUrlencode(k)}=${phpUrlencode(val)}`)
    .join('&');
}

export function buildEncryptInfo(params, hashKey, hashIV) {
  const plain = httpBuildQuery(params);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(hashKey, 'utf8'), Buffer.from(hashIV, 'utf8'));
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = enc.toString('base64') + ':::' + tag.toString('base64');
  return Buffer.from(combined, 'utf8').toString('hex');
}

export function buildHashInfo(encryptInfo, hashKey, hashIV) {
  return createHash('sha256').update(hashKey + encryptInfo + hashIV, 'utf8').digest('hex').toUpperCase();
}

export function decryptInfo(encHex, hashKey, hashIV) {
  const combined = Buffer.from(encHex, 'hex').toString('utf8');
  const [cipherB64, tagB64] = combined.split(':::');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(hashKey, 'utf8'), Buffer.from(hashIV, 'utf8'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const dec = Buffer.concat([decipher.update(Buffer.from(cipherB64, 'base64')), decipher.final()]);
  return Object.fromEntries(new URLSearchParams(dec.toString('utf8')));
}

export function verifyNotify(body, hashKey, hashIV) {
  const enc = String((body && body.EncryptInfo) || '');
  const received = String((body && body.HashInfo) || '').toUpperCase();
  const computed = buildHashInfo(enc, hashKey, hashIV);
  if (received.length !== computed.length) return { ok: false, data: null };
  if (!timingSafeEqual(Buffer.from(received), Buffer.from(computed))) return { ok: false, data: null };
  try {
    return { ok: true, data: decryptInfo(enc, hashKey, hashIV) };
  } catch {
    return { ok: false, data: null };
  }
}
