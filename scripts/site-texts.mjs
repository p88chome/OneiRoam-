// 後台「文字內容」：讓店主改頁面上固定的說明文字（data-zh / data-en 那些），版型不動。
//
// key = 原始中文（原始碼裡 data-zh 的值）。同一句出現在多頁（導覽、頁尾）共用同一個 key，
// 改一次全站生效。覆寫存在 settings 表的 `texts`（JSON：{ [key]: { zh, en } }），
// 發布時 build 套用；覆寫過的元素加 data-tk 記住原 key，重跑 build 也對得上。
// BUILD:*:START/END 區塊（商品卡、hero 等）由各自的設定管，這裡一律跳過。

const BLOCK_OR_PAIR =
  /<!-- BUILD:(\w+):START -->[\s\S]*?<!-- BUILD:\1:END -->|data-zh="([^"]*)" data-en="([^"]*)"([^>]*)>([^<]*)/g;

const decode = s => String(s)
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const attr = s => String(s)
  .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const text = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const tkOf = rest => {
  const m = /\sdata-tk="([^"]*)"/.exec(rest);
  return m ? decode(m[1]) : null;
};

export function parseTexts(raw) {
  try {
    const o = JSON.parse(raw || '{}');
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch {
    return {};
  }
}

export function applyTexts(html, texts) {
  if (!texts || !Object.keys(texts).length) return html;
  return html.replace(BLOCK_OR_PAIR, (m, block, zh, en, rest, inner) => {
    if (block) return m;
    const key = tkOf(rest) ?? decode(zh);
    // 只認自己的 key（擋 __proto__ / constructor 這類繼承屬性）
    const ov = Object.hasOwn(texts, key) ? texts[key] : null;
    if (!ov || typeof ov !== 'object') return m;
    const curZh = decode(zh);
    const newZh = typeof ov.zh === 'string' && ov.zh.trim() ? ov.zh.trim() : curZh;
    const newEn = typeof ov.en === 'string' && ov.en.trim() ? ov.en.trim() : decode(en);
    const newRest = tkOf(rest) === null ? `${rest} data-tk="${attr(key)}"` : rest;
    // 只有元素內文就是那句中文時才換內文（有子元素的不碰，切語言時 JS 會用 data-* 補上）
    const lead = inner.match(/^\s*/)[0];
    const trail = inner.match(/\s*$/)[0];
    const newInner = decode(inner).trim() === curZh ? `${lead}${text(newZh)}${trail}` : inner;
    return `data-zh="${attr(newZh)}" data-en="${attr(newEn)}"${newRest}>${newInner}`;
  });
}

// 後台分組：共用區塊依 landmark id，其餘依頁面
const SHARED_GROUPS = {
  loader: '頁首／選單', header: '頁首／選單', 'main-nav': '頁首／選單', mobileOverlay: '頁首／選單',
  footer: '頁尾', modalGallery: '商品彈窗',
};
const INDEX_GROUPS = {
  hero: '首頁大圖', collections: '獨立設計區', select: '選品區', lookbook: 'Lookbook',
  order: '購物須知與下單流程', about: '關於夢游',
};
const PAGE_GROUPS = { 'select.html': '選品頁', 'order.html': '結帳頁', 'member.html': '會員頁' };

export const GROUP_ORDER = [
  '頁首／選單', '首頁大圖', '獨立設計區', '選品區', 'Lookbook', '購物須知與下單流程', '關於夢游',
  '商品彈窗', '選品頁', '結帳頁', '會員頁', '頁尾',
];

// 從原始碼頁面整理出可改的文字清單（後台顯示用）。重複的句子只留第一次出現。
export function extractTexts(pages) {
  const seen = new Map();
  for (const [page, html] of pages) {
    const marks = [...html.matchAll(/<(?:section|header|footer|nav|div|aside|main|form)\b[^>]*\bid="([^"]+)"/g)]
      .map(m => ({ pos: m.index, id: m[1] }));
    let lastIndexGroup = '頁首／選單';
    const groupAt = pos => {
      let g = null;
      for (const mk of marks) {
        if (mk.pos > pos) break;
        if (SHARED_GROUPS[mk.id]) g = SHARED_GROUPS[mk.id];
        else if (page === 'index.html' && INDEX_GROUPS[mk.id]) g = INDEX_GROUPS[mk.id];
        else if (page !== 'index.html') g = PAGE_GROUPS[page] || page;
      }
      if (page === 'index.html') { if (g) lastIndexGroup = g; return g || lastIndexGroup; }
      return g || PAGE_GROUPS[page] || page;
    };
    for (const m of html.matchAll(BLOCK_OR_PAIR)) {
      if (m[1]) continue;
      const key = tkOf(m[4]) ?? decode(m[2]);
      if (!key.trim() || seen.has(key)) continue;
      seen.set(key, { key, zh: key, en: decode(m[3]), group: groupAt(m.index), page });
    }
  }
  return [...seen.values()];
}
