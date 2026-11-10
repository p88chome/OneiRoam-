// 後台「文字內容」：讓店主改頁面上固定的說明文字（data-zh / data-en 那些），外觀不變。
//
// 單句：key = 原始中文（原始碼裡 data-zh 的值）。同一句出現在多頁（導覽、頁尾）共用同一個 key，
// 改一次全站生效。覆寫存在 settings 表的 `texts`（JSON：{ [key]: { zh, en } }），
// 發布時 build 套用；覆寫過的元素加 data-tk 記住原 key，重跑 build 也對得上。
//
// 清單：可增刪、排序的段落（購物須知、關於的段落…）在原始碼用 <!-- LIST:name:START/END --> 圈起來，
// 存在 settings 的 `text_lists`（JSON：{ [name]: [{ zh, en }, ...] }）。
// 新增的條目沿用第一條的標籤與 class，所以外觀跟原本一樣。
//
// BUILD:*:START/END 區塊（商品卡、hero 等）由各自的設定管，這裡一律跳過。

const BLOCK_OR_PAIR =
  /<!-- (BUILD|LIST):([\w-]+):START -->[\s\S]*?<!-- \1:\2:END -->|data-zh="([^"]*)" data-en="([^"]*)"([^>]*)>([^<]*)/g;
const LIST_BLOCK = /(<!-- LIST:([\w-]+):START -->)([\s\S]*?)(\r?\n?[ \t]*<!-- LIST:\2:END -->)/g;
const LIST_ITEM =
  /([ \t]*)<([a-z][a-z0-9]*)([^>]*?)\s+data-zh="([^"]*)" data-en="([^"]*)"([^>]*)>[^<]*<\/\2>/g;
const MAX_LIST_ITEMS = 50;

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
  return html.replace(BLOCK_OR_PAIR, (m, block, _name, zh, en, rest, inner) => {
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

const listItems = block => [...block.matchAll(LIST_ITEM)]
  .map(m => ({ zh: decode(m[4]), en: decode(m[5]) }));

// 清單覆寫：整段換成新條目（沿用第一條的縮排、標籤、其他屬性）。空中文的條目略過。
export function applyLists(html, lists) {
  if (!lists || typeof lists !== 'object') return html;
  return html.replace(LIST_BLOCK, (m, start, name, body, end) => {
    const items = Object.hasOwn(lists, name) ? lists[name] : null;
    if (!Array.isArray(items)) return m;
    const first = [...body.matchAll(LIST_ITEM)][0];
    if (!first) return m;
    const [, indent, tag, before, , , after] = first;
    const others = `${before}${after}`.replace(/\s+data-tk="[^"]*"/g, '');
    const nl = body.includes('\r\n') ? '\r\n' : '\n';
    const out = items.slice(0, MAX_LIST_ITEMS)
      .filter(it => it && typeof it.zh === 'string' && it.zh.trim())
      .map(it => {
        const zh = it.zh.trim();
        // 英文留白就顯示中文，切到英文時才不會變成空的
        const en = typeof it.en === 'string' && it.en.trim() ? it.en.trim() : zh;
        return `${nl}${indent}<${tag}${others} data-zh="${attr(zh)}" data-en="${attr(en)}">${text(zh)}</${tag}>`;
      }).join('');
    return `${start}${out}${end}`;
  });
}

// 後台分組：共用區塊依 landmark id，其餘依頁面
const SHARED_GROUPS = {
  loader: '頁首／選單', header: '頁首／選單', 'main-nav': '頁首／選單', mobileOverlay: '頁首／選單',
  footer: '頁尾', modalGallery: '商品彈窗',
};
const INDEX_GROUPS = {
  hero: '首頁大圖', collections: '獨立設計區', select: '選品區', lookbook: 'Lookbook',
  order: '購物須知', about: '關於夢游',
};
const PAGE_GROUPS = { 'select.html': '選品頁', 'order.html': '結帳頁', 'member.html': '會員頁' };

export const GROUP_ORDER = [
  '頁首／選單', '首頁大圖', '獨立設計區', '選品區', 'Lookbook', '購物須知', '關於夢游',
  '商品彈窗', '選品頁', '結帳頁', '會員頁', '頁尾',
];

// 從原始碼頁面整理出可改的文字（後台顯示用）：單句去重；清單整段一筆。
export function extractTexts(pages) {
  const seen = new Map();
  const lists = new Map();
  for (const [page, html] of pages) {
    const marks = [...html.matchAll(/<(?:section|header|footer|nav|div|aside|main|form)\b[^>]*\bid="([^"]+)"/g)]
      .map(m => ({ pos: m.index, id: m[1] }));
    const groupAt = pos => {
      let g = null;
      for (const mk of marks) {
        if (mk.pos > pos) break;
        if (SHARED_GROUPS[mk.id]) g = SHARED_GROUPS[mk.id];
        else if (page === 'index.html' && INDEX_GROUPS[mk.id]) g = INDEX_GROUPS[mk.id];
        else if (page !== 'index.html') g = PAGE_GROUPS[page] || page;
      }
      return g || (page === 'index.html' ? '頁首／選單' : PAGE_GROUPS[page] || page);
    };
    for (const m of html.matchAll(BLOCK_OR_PAIR)) {
      if (m[1] === 'LIST') {
        if (!lists.has(m[2])) {
          lists.set(m[2], { list: m[2], group: groupAt(m.index), page, items: listItems(m[0]) });
        }
        continue;
      }
      if (m[1]) continue;
      const key = tkOf(m[5]) ?? decode(m[3]);
      if (!key.trim() || seen.has(key)) continue;
      seen.set(key, { key, zh: key, en: decode(m[4]), group: groupAt(m.index), page });
    }
  }
  return { texts: [...seen.values()], lists: [...lists.values()] };
}
