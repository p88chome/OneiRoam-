// admin-texts.js — 後台「文字內容」：改網站上的文字（外觀不變）。
// 清單來自發布時 build 產生的 data/texts-catalog.json（{ texts, lists }：原始文字＋分組）。
// - 單句覆寫存 settings.texts（{ 原始中文: { zh, en } }）
// - 清單（購物須知、關於段落…可增刪排序）存 settings.text_lists（{ 清單名: [{ zh, en }] }）
// 按「發布到網站」才會套到頁面上。依賴 admin.js 的 esc / viewRoot / setActiveNav / friendlyErr。
(() => {
  const GROUP_ORDER = [
    '頁首／選單', '首頁大圖', '獨立設計區', '選品區', 'Lookbook', '購物須知', '關於夢游',
    '商品彈窗', '選品頁', '結帳頁', '會員頁', '頁尾',
  ];
  const OPEN_BY_DEFAULT = new Set(['購物須知', '關於夢游']);
  const LIST_LABELS = { guide: '購物須知條列', 'about-paragraphs': '關於段落', 'about-tags': '關於標籤' };

  let texts = [];        // [{ key, zh, en, group }]
  let lists = [];        // [{ list, group, items: [{ zh, en }] }]（原始）
  let saved = {};        // DB 裡的 texts（含清單裡已不存在的 key，存檔時保留）
  let savedLists = {};   // DB 裡的 text_lists
  let work = {};         // 清單編輯中的狀態：{ 清單名: [{ zh, en }] }

  const parse = raw => { try { const o = JSON.parse(raw || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch { return {}; } };
  const isLong = s => String(s || '').length > 28;

  function textItemHtml(t, i) {
    const ov = saved[t.key] || {};
    const zh = (ov.zh || '').trim() || t.zh;
    const en = (ov.en || '').trim() || t.en;
    const changed = zh !== t.zh || en !== t.en;
    const zhInput = isLong(t.zh) || isLong(zh)
      ? `<textarea data-lang="zh" rows="3">${esc(zh)}</textarea>`
      : `<input data-lang="zh" value="${esc(zh)}">`;
    return `
      <div class="text-item${changed ? ' is-changed' : ''}" data-row="${i}" data-search="${esc((t.zh + ' ' + t.en).toLowerCase())}">
        <div class="text-item-head">
          <span class="muted">原文：${esc(t.zh)}</span>
          <span class="text-changed-tag">已修改</span>
          <button type="button" class="btn btn-sm btn-ghost" data-reset="${i}">還原</button>
        </div>
        <label class="field"><span>中文</span>${zhInput}</label>
        <label class="field"><span>English（可留白＝沿用原英文）</span>
          <input data-lang="en" value="${esc(en)}"></label>
      </div>`;
  }

  function listHtml(l) {
    const items = work[l.list];
    const rows = items.map((it, j) => `
      <div class="list-item" data-j="${j}">
        <div class="text-item-head">
          <span class="muted">第 ${j + 1} 條</span>
          <button type="button" class="btn btn-sm btn-ghost" data-move="-1" ${j === 0 ? 'disabled' : ''} aria-label="上移">↑</button>
          <button type="button" class="btn btn-sm btn-ghost" data-move="1" ${j === items.length - 1 ? 'disabled' : ''} aria-label="下移">↓</button>
          <button type="button" class="btn btn-sm btn-ghost" data-del>刪除</button>
        </div>
        <label class="field"><span>中文</span>${isLong(it.zh) || l.list !== 'about-tags'
          ? `<textarea data-lang="zh" rows="3">${esc(it.zh)}</textarea>`
          : `<input data-lang="zh" value="${esc(it.zh)}">`}</label>
        <label class="field"><span>English（可留白＝顯示中文）</span>
          <input data-lang="en" value="${esc(it.en)}"></label>
      </div>`).join('');
    return `
      <div class="text-list" data-list="${esc(l.list)}">
        <div class="text-item-head">
          <b>${esc(LIST_LABELS[l.list] || l.list)}</b>
          <span class="muted">（${items.length} 條，可新增、刪除、調整順序）</span>
          <button type="button" class="btn btn-sm btn-ghost" data-list-reset>還原</button>
        </div>
        ${rows || '<p class="muted">（目前沒有任何條目，網站上這一區會是空的）</p>'}
        <button type="button" class="btn btn-sm" data-add>＋ 新增一條</button>
      </div>`;
  }

  function render() {
    const groups = new Map(GROUP_ORDER.map(g => [g, []]));
    const push = (g, h) => { if (!groups.has(g)) groups.set(g, []); groups.get(g).push(h); };
    lists.forEach(l => push(l.group, listHtml(l)));
    texts.forEach((t, i) => push(t.group, textItemHtml(t, i)));
    viewRoot().innerHTML = `<div id="textsView">
      <div class="view-head"><h2>文字內容</h2></div>
      <div class="card form-card">
        <p class="muted">修改網站上的文字（外觀與排版不變）。購物須知、關於段落等清單可以新增、刪除、調整順序。
          同一句出現在多頁（例如選單、頁尾）會一起改。改完按「儲存」，再按右上「發布到網站」，約 1–2 分鐘後生效。</p>
        <div class="texts-toolbar">
          <input id="textsSearch" type="search" placeholder="搜尋文字…">
          <button id="textsSaveBtn" class="btn btn-primary">儲存</button>
          <span id="textsMsg" class="muted" role="status"></span>
          <span id="textsErr" class="err" role="alert"></span>
        </div>
        ${[...groups].filter(([, items]) => items.length).map(([g, items]) => `
          <details class="text-group" data-group="${esc(g)}" ${OPEN_BY_DEFAULT.has(g) ? 'open' : ''}>
            <summary>${esc(g)}</summary>
            ${items.join('')}
          </details>`).join('')}
      </div></div>`;
    bind();
  }

  // 只重畫一個清單（保留其他欄位正在編輯的內容）
  function rerenderList(name) {
    const el = document.querySelector(`#textsView .text-list[data-list="${CSS.escape(name)}"]`);
    const l = lists.find(x => x.list === name);
    if (el && l) el.outerHTML = listHtml(l);
  }

  function readList(el) {
    return [...el.querySelectorAll('.list-item')].map(r => ({
      zh: r.querySelector('[data-lang="zh"]').value,
      en: r.querySelector('[data-lang="en"]').value,
    }));
  }

  function bind() {
    // 綁在本次產生的容器上（viewRoot 會跨分頁重用，綁在它上面會重複累積）
    const root = document.getElementById('textsView');
    root.addEventListener('input', e => {
      const row = e.target.closest('[data-row]');
      if (row) markChanged(row);
      const listEl = e.target.closest('.text-list');
      if (listEl) work[listEl.dataset.list] = readList(listEl);
    });
    root.addEventListener('click', e => {
      const reset = e.target.closest('[data-reset]');
      if (reset) {
        const t = texts[+reset.dataset.reset];
        const row = reset.closest('[data-row]');
        row.querySelector('[data-lang="zh"]').value = t.zh;
        row.querySelector('[data-lang="en"]').value = t.en;
        markChanged(row);
        return;
      }
      const listEl = e.target.closest('.text-list');
      if (!listEl) return;
      const name = listEl.dataset.list;
      const items = readList(listEl);
      const j = +(e.target.closest('.list-item') || {}).dataset?.j;
      if (e.target.closest('[data-add]')) items.push({ zh: '', en: '' });
      else if (e.target.closest('[data-del]')) items.splice(j, 1);
      else if (e.target.closest('[data-move]')) {
        const k = j + +e.target.closest('[data-move]').dataset.move;
        [items[j], items[k]] = [items[k], items[j]];
      } else if (e.target.closest('[data-list-reset]')) {
        work[name] = lists.find(x => x.list === name).items.map(it => ({ ...it }));
        rerenderList(name);
        return;
      } else return;
      work[name] = items;
      rerenderList(name);
    });
    document.getElementById('textsSearch').addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      root.querySelectorAll('[data-row]').forEach(r => {
        const zh = r.querySelector('[data-lang="zh"]').value.toLowerCase();
        r.style.display = !q || r.dataset.search.includes(q) || zh.includes(q) ? '' : 'none';
      });
      root.querySelectorAll('.text-list').forEach(l => {
        const all = [...l.querySelectorAll('textarea, input')].map(i => i.value.toLowerCase()).join(' ');
        l.style.display = !q || all.includes(q) ? '' : 'none';
      });
      root.querySelectorAll('.text-group').forEach(d => { if (q) d.open = true; });
    });
    document.getElementById('textsSaveBtn').onclick = save;
  }

  function markChanged(row) {
    const t = texts[+row.dataset.row];
    const zh = row.querySelector('[data-lang="zh"]').value.trim();
    const en = row.querySelector('[data-lang="en"]').value.trim();
    row.classList.toggle('is-changed', zh !== t.zh || (en !== '' && en !== t.en));
  }

  const sameList = (a, b) => a.length === b.length &&
    a.every((it, i) => it.zh === b[i].zh && (it.en || '') === (b[i].en || ''));

  async function save() {
    const btn = document.getElementById('textsSaveBtn');
    const msg = document.getElementById('textsMsg');
    const errEl = document.getElementById('textsErr');
    msg.textContent = ''; errEl.textContent = '';
    const root = document.getElementById('textsView');

    const next = { ...saved };
    for (const row of root.querySelectorAll('[data-row]')) {
      const t = texts[+row.dataset.row];
      const zh = row.querySelector('[data-lang="zh"]').value.trim();
      const en = row.querySelector('[data-lang="en"]').value.trim();
      if (!zh) { errEl.textContent = `「${t.zh.slice(0, 20)}」的中文不能空白（要恢復原文請按「還原」）`; return; }
      const ov = {};
      if (zh !== t.zh) ov.zh = zh;
      if (en && en !== t.en) ov.en = en;
      if (Object.keys(ov).length) next[t.key] = ov; else delete next[t.key];
    }

    const nextLists = { ...savedLists };
    for (const l of lists) {
      const items = (work[l.list] || []).map(it => ({ zh: it.zh.trim(), en: it.en.trim() }));
      if (items.some(it => !it.zh)) {
        errEl.textContent = `「${LIST_LABELS[l.list] || l.list}」有空白的條目，請填寫或刪除`;
        return;
      }
      if (sameList(items, l.items)) delete nextLists[l.list]; else nextLists[l.list] = items;
    }

    btn.disabled = true; btn.textContent = '儲存中…';
    try {
      await window.adminData.saveSettings([
        { key: 'texts', value: JSON.stringify(next) },
        { key: 'text_lists', value: JSON.stringify(nextLists) },
      ]);
      saved = next; savedLists = nextLists;
      const n = Object.keys(next).length + Object.keys(nextLists).length;
      msg.textContent = `✓ 已儲存（共 ${n} 處修改），記得按「發布到網站」`;
    } catch (e) {
      errEl.textContent = friendlyErr(e);
    } finally {
      btn.disabled = false; btn.textContent = '儲存';
    }
  }

  window.renderTextsEditor = async () => {
    setActiveNav('texts');
    viewRoot().innerHTML = '<p class="muted">載入中…</p>';
    try {
      const [cat, s] = await Promise.all([
        fetch('data/texts-catalog.json', { cache: 'no-store' }).then(r => (r.ok ? r.json() : {})),
        window.sb.from('settings').select('key, value').in('key', ['texts', 'text_lists']),
      ]);
      if (s.error) throw s.error;
      // 舊格式（純陣列）相容
      texts = Array.isArray(cat) ? cat : (cat.texts || []);
      lists = Array.isArray(cat) ? [] : (cat.lists || []);
      const rows = Object.fromEntries((s.data || []).map(r => [r.key, r.value]));
      saved = parse(rows.texts);
      savedLists = parse(rows.text_lists);
      work = Object.fromEntries(lists.map(l => [l.list,
        (Array.isArray(savedLists[l.list]) ? savedLists[l.list] : l.items)
          .map(it => ({ zh: String(it.zh || ''), en: String(it.en || '') }))]));
      if (!texts.length && !lists.length) {
        viewRoot().innerHTML = '<p class="muted">還沒有文字清單，請先按一次「發布到網站」，完成後重新整理此頁。</p>';
        return;
      }
      render();
    } catch (e) {
      viewRoot().innerHTML = `<p class="err">讀取失敗：${esc(friendlyErr(e))}</p>`;
    }
  };
})();
