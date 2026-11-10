// admin-texts.js — 後台「文字內容」：改網站上固定的說明文字（版型不動）。
// 清單來自發布時 build 產生的 data/texts-catalog.json（原始文字＋分組）；
// 覆寫存 settings.texts（JSON：{ 原始中文: { zh, en } }），按「發布到網站」才會套到頁面上。
// 依賴 admin.js 的 window.sb / esc / viewRoot / setActiveNav / friendlyErr。
(() => {
  const GROUP_ORDER = [
    '頁首／選單', '首頁大圖', '獨立設計區', '選品區', 'Lookbook', '購物須知與下單流程', '關於夢游',
    '商品彈窗', '選品頁', '結帳頁', '會員頁', '頁尾',
  ];
  const OPEN_BY_DEFAULT = new Set(['購物須知與下單流程', '關於夢游']);

  let catalog = [];
  let saved = {};   // 目前 DB 裡的覆寫（含清單裡已不存在的 key，存檔時保留）

  const field = (t, lang) => {
    const ov = saved[t.key] || {};
    const v = (ov[lang] || '').trim();
    return v || t[lang] || '';
  };

  function itemHtml(t, i) {
    const zh = field(t, 'zh');
    const en = field(t, 'en');
    const long = t.zh.length > 28 || zh.length > 28;
    const changed = zh !== t.zh || en !== t.en;
    const zhInput = long
      ? `<textarea data-i="${i}" data-lang="zh" rows="3">${esc(zh)}</textarea>`
      : `<input data-i="${i}" data-lang="zh" value="${esc(zh)}">`;
    return `
      <div class="text-item${changed ? ' is-changed' : ''}" data-row="${i}" data-search="${esc((t.zh + ' ' + t.en).toLowerCase())}">
        <div class="text-item-head">
          <span class="muted">原文：${esc(t.zh)}</span>
          <span class="text-changed-tag">已修改</span>
          <button type="button" class="btn btn-sm btn-ghost" data-reset="${i}">還原</button>
        </div>
        <label class="field"><span>中文</span>${zhInput}</label>
        <label class="field"><span>English（可留白＝沿用原英文）</span>
          <input data-i="${i}" data-lang="en" value="${esc(en)}"></label>
      </div>`;
  }

  function render() {
    const groups = new Map(GROUP_ORDER.map(g => [g, []]));
    catalog.forEach((t, i) => {
      if (!groups.has(t.group)) groups.set(t.group, []);
      groups.get(t.group).push(itemHtml(t, i));
    });
    viewRoot().innerHTML = `<div id="textsView">
      <div class="view-head"><h2>文字內容</h2></div>
      <div class="card form-card">
        <p class="muted">修改網站上的說明文字（版面不變）。同一句出現在多頁（例如選單、頁尾）會一起改。
          改完按「儲存」，再按右上「發布到網站」，約 1–2 分鐘後生效。</p>
        <div class="texts-toolbar">
          <input id="textsSearch" type="search" placeholder="搜尋文字…">
          <button id="textsSaveBtn" class="btn btn-primary">儲存</button>
          <span id="textsMsg" class="muted" role="status"></span>
          <span id="textsErr" class="err" role="alert"></span>
        </div>
        ${[...groups].filter(([, items]) => items.length).map(([g, items]) => `
          <details class="text-group" ${OPEN_BY_DEFAULT.has(g) ? 'open' : ''}>
            <summary>${esc(g)} <span class="muted">（${items.length}）</span></summary>
            ${items.join('')}
          </details>`).join('')}
      </div></div>`;

    // 綁在本次產生的容器上（viewRoot 會跨分頁重用，綁在它上面會重複累積）
    const root = document.getElementById('textsView');
    root.addEventListener('input', e => {
      const row = e.target.closest('[data-row]');
      if (row) markChanged(row);
    });
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-reset]');
      if (!b) return;
      const t = catalog[+b.dataset.reset];
      const row = b.closest('[data-row]');
      row.querySelector('[data-lang="zh"]').value = t.zh;
      row.querySelector('[data-lang="en"]').value = t.en;
      markChanged(row);
    });
    document.getElementById('textsSearch').addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      root.querySelectorAll('[data-row]').forEach(r => {
        const zh = r.querySelector('[data-lang="zh"]').value.toLowerCase();
        r.style.display = !q || r.dataset.search.includes(q) || zh.includes(q) ? '' : 'none';
      });
      root.querySelectorAll('.text-group').forEach(d => { if (q) d.open = true; });
    });
    document.getElementById('textsSaveBtn').onclick = save;
  }

  function markChanged(row) {
    const t = catalog[+row.dataset.row];
    const zh = row.querySelector('[data-lang="zh"]').value.trim();
    const en = row.querySelector('[data-lang="en"]').value.trim();
    row.classList.toggle('is-changed', zh !== t.zh || (en !== '' && en !== t.en));
  }

  async function save() {
    const btn = document.getElementById('textsSaveBtn');
    const msg = document.getElementById('textsMsg');
    const errEl = document.getElementById('textsErr');
    msg.textContent = ''; errEl.textContent = '';
    const next = { ...saved };
    for (const row of document.getElementById('textsView').querySelectorAll('[data-row]')) {
      const t = catalog[+row.dataset.row];
      const zh = row.querySelector('[data-lang="zh"]').value.trim();
      const en = row.querySelector('[data-lang="en"]').value.trim();
      if (!zh) { errEl.textContent = `「${t.zh.slice(0, 20)}」的中文不能空白（要恢復原文請按「還原」）`; return; }
      const ov = {};
      if (zh !== t.zh) ov.zh = zh;
      if (en && en !== t.en) ov.en = en;
      if (Object.keys(ov).length) next[t.key] = ov; else delete next[t.key];
    }
    btn.disabled = true; btn.textContent = '儲存中…';
    try {
      await window.adminData.saveSettings([{ key: 'texts', value: JSON.stringify(next) }]);
      saved = next;
      msg.textContent = `✓ 已儲存（共 ${Object.keys(next).length} 處修改），記得按「發布到網站」`;
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
        fetch('data/texts-catalog.json', { cache: 'no-store' }).then(r => (r.ok ? r.json() : [])),
        window.sb.from('settings').select('value').eq('key', 'texts').maybeSingle(),
      ]);
      if (s.error) throw s.error;
      catalog = Array.isArray(cat) ? cat : [];
      try { saved = JSON.parse((s.data && s.data.value) || '{}') || {}; } catch { saved = {}; }
      if (!catalog.length) {
        viewRoot().innerHTML = '<p class="muted">還沒有文字清單，請先按一次「發布到網站」，完成後重新整理此頁。</p>';
        return;
      }
      render();
    } catch (e) {
      viewRoot().innerHTML = `<p class="err">讀取失敗：${esc(friendlyErr(e))}</p>`;
    }
  };
})();
