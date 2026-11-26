const test = require('node:test');
const assert = require('node:assert');
const { orderRows, makeXlsx, taipeiTime, crc32 } = require('../order-export.js');

const ORDER = {
  order_no: '20261115123456', created_at: '2026-11-15T12:30:00Z',
  payment_status: 'paid', fulfillment_status: 'unfulfilled',
  name: '王小明', phone: '0912345678', social: '@ming', email: 'a@b.c',
  total: 1080, pay_amount: 540, discount_code: null, notes: '=HYPERLINK("x")',
  pay_bank: '822', pay_no: '1234567890', pay_expire: '2026-11-20 23:59:59',
  order_items: [{ name: '洋裝', size: 'M', price: 1080, qty: 1 }, { name: '襪', size: '', price: 0, qty: 2 }],
};

test('taipeiTime: UTC → 台灣時間', () => {
  assert.strictEqual(taipeiTime('2026-11-15T17:05:00Z'), '2026-11-16 01:05');
  assert.strictEqual(taipeiTime('bad'), '');
});

test('orderRows: 表頭＋每筆訂單一列', () => {
  const rows = orderRows([ORDER]);
  assert.strictEqual(rows.length, 2);
  const r = rows[1];
  assert.strictEqual(r[0], '20261115123456');
  assert.strictEqual(r[1], '2026-11-15 20:30');
  assert.strictEqual(r[2], '已付款');
  assert.strictEqual(r[6], '0912345678');
  assert.strictEqual(r[9], '洋裝（M） ×1\n襪 ×2');
  assert.strictEqual(r[10], 3);
  assert.strictEqual(r[14], 'ATM (822) 1234567890');
  assert.strictEqual(rows[0].length, r.length);
});

test('crc32: 已知值', () => {
  assert.strictEqual(crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
});

// 解 zip（store）找出 sheet1.xml
function readEntry(buf, want) {
  const dv = new DataView(buf.buffer, buf.byteOffset);
  let p = 0;
  while (dv.getUint32(p, true) === 0x04034b50) {
    const size = dv.getUint32(p + 18, true), nlen = dv.getUint16(p + 26, true);
    const name = Buffer.from(buf.subarray(p + 30, p + 30 + nlen)).toString();
    const data = buf.subarray(p + 30 + nlen, p + 30 + nlen + size);
    if (name === want) {
      assert.strictEqual(crc32(data), dv.getUint32(p + 14, true));
      return Buffer.from(data).toString();
    }
    p += 30 + nlen + size;
  }
  return null;
}

test('makeXlsx: 字串存成文字、數字存成數字、跳脫 XML、公式不會執行', () => {
  const buf = makeXlsx('訂單', orderRows([ORDER]));
  assert.strictEqual(buf[0], 0x50); assert.strictEqual(buf[1], 0x4b);
  const xml = readEntry(buf, 'xl/worksheets/sheet1.xml');
  assert.ok(xml.includes('<c r="G2" t="inlineStr" s="2"><is><t xml:space="preserve">0912345678</t>'));
  assert.ok(xml.includes('<c r="K2" s="2"><v>3</v></c>'));
  assert.ok(xml.includes('=HYPERLINK(&quot;x&quot;)'));
  assert.ok(!xml.includes('<f>'));
  assert.ok(readEntry(buf, '[Content_Types].xml'));
});
