/* order-export.js — 後台「匯出 Excel」：訂單 → .xlsx（不用外部套件）。
   - 文字一律寫成字串儲存格（inlineStr）：電話開頭的 0、長訂單編號不會被 Excel 吃掉或變科學記號，
     客人填的「=…」也不會被當成公式執行
   - zip 用 store（不壓縮）；訂單量小，檔案大小沒差 */
(function (global) {
  const PAY = { pending: '待付款', paid: '已付款', failed: '付款失敗', expired: '已失效' };
  const FULFILL = { unfulfilled: '未出貨', shipped: '已出貨', cancelled: '已取消' };

  // ISO 時間 → 台灣時間 'YYYY-MM-DD HH:MM'
  function taipeiTime(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const t = new Date(d.getTime() + 8 * 3600 * 1000).toISOString();
    return t.slice(0, 10) + ' ' + t.slice(11, 16);
  }

  const HEADER = ['訂單編號', '下單時間', '付款狀態', '出貨狀態', '姓名', '電話', 'Line/IG', 'Email',
    '商品明細', '件數', '商品合計', '本次付款', '折扣碼', '繳費代碼', '繳費期限', '備註'];

  function orderRows(orders) {
    const rows = [HEADER];
    for (const o of orders) {
      const items = o.order_items || [];
      rows.push([
        o.order_no, taipeiTime(o.created_at),
        PAY[o.payment_status] || o.payment_status, FULFILL[o.fulfillment_status] || o.fulfillment_status,
        o.name, o.phone, o.social, o.email,
        items.map(i => `${i.name}${i.size ? `（${i.size}）` : ''} ×${i.qty}`).join('\n'),
        items.reduce((n, i) => n + (Number(i.qty) || 0), 0),
        Number(o.total) || 0, Number(o.pay_amount) || 0,
        o.discount_code,
        o.pay_no ? (o.pay_bank ? `ATM (${o.pay_bank}) ${o.pay_no}` : `超商 ${o.pay_no}`) : '',
        o.pay_no ? o.pay_expire : '',
        o.notes,
      ]);
    }
    return rows;
  }

  // ---- xlsx ----
  const xmlEsc = s => String(s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function colName(i) {
    let s = '';
    for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s;
    return s;
  }

  function sheetXml(rows) {
    const body = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
      if (v === null || v === undefined || v === '') return '';
      const ref = colName(ci) + (ri + 1);
      const style = ri === 0 ? ' s="1"' : ' s="2"';
      if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"${style}><v>${v}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
    }).join('')}</row>`).join('');
    const widths = [16, 17, 10, 10, 12, 13, 16, 24, 36, 6, 10, 10, 12, 22, 18, 30];
    const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      `<cols>${cols}</cols><sheetData>${body}</sheetData></worksheet>`;
  }

  const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';

  function xlsxFiles(sheetName, rows) {
    return {
      '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '</Types>',
      '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
      'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        `<sheets><sheet name="${xmlEsc(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>',
      'xl/styles.xml': STYLES,
      'xl/worksheets/sheet1.xml': sheetXml(rows),
    };
  }

  // ---- zip（store）----
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function zip(files) {
    const enc = new TextEncoder();
    const parts = [], central = [];
    let offset = 0;
    for (const [name, content] of Object.entries(files)) {
      const nameB = enc.encode(name);
      const data = typeof content === 'string' ? enc.encode(content) : content;
      const crc = crc32(data);
      const local = new Uint8Array(30 + nameB.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true);
      lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true);
      lv.setUint16(26, nameB.length, true);
      local.set(nameB, 30);
      const cen = new Uint8Array(46 + nameB.length);
      const cv = new DataView(cen.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
      cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameB.length, true); cv.setUint32(42, offset, true);
      cen.set(nameB, 46);
      parts.push(local, data); central.push(cen);
      offset += local.length + data.length;
    }
    const cenSize = central.reduce((n, c) => n + c.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, central.length, true); ev.setUint16(10, central.length, true);
    ev.setUint32(12, cenSize, true); ev.setUint32(16, offset, true);
    const all = [...parts, ...central, end];
    const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
    let p = 0;
    for (const a of all) { out.set(a, p); p += a.length; }
    return out;
  }

  const makeXlsx = (sheetName, rows) => zip(xlsxFiles(sheetName, rows));

  const api = { orderRows, makeXlsx, taipeiTime, crc32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.orderExport = api;
})(typeof window !== 'undefined' ? window : globalThis);
