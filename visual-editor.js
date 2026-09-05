// visual-editor.js — 視覺編輯視圖：左 iframe 預覽、右屬性面板、postMessage 橋、草稿 + 存檔/發布。
// 依賴 admin.js 的 window.sb 與 admin-data.js 的 window.adminData；載入順序在兩者之後。
(() => {
  const escAttr = s => String(s ?? '').replace(/"/g, '&quot;');
  const PREVIEW_ORIGIN = location.origin;

  // 右欄文字欄位（key 對 settings key）；區塊點擊 → 聚焦第一個相關欄位
  const TEXT_FIELDS = [
    ['announce_zh', '公告列（中）'], ['announce_en', '公告列（英，可留白）'],
    ['hero_eyebrow_zh', 'Hero 小標（中）'], ['hero_eyebrow_en', 'Hero 小標（英，可留白）'],
    ['hero_desc_zh', 'Hero 描述（中）'], ['hero_desc_en', 'Hero 描述（英，可留白）'],
  ];
  const EDIT_TO_FIELD = {
    announce: 'announce_zh', hero_eyebrow: 'hero_eyebrow_zh',
    hero_desc: 'hero_desc_zh', hero_img: 's_focus1',
  };
  const THEME_OPTIONS = [
    ['default', '夢幻粉紫'], ['sage', '米綠'], ['latte', '奶茶'], ['mist', '霧藍'],
  ];

  let draft = {};      // 目前草稿 settings
  let iframe = null;
  let ready = false;   // iframe(harness)是否已回報 ready

  const post = msg => iframe && iframe.contentWindow &&
    iframe.contentWindow.postMessage({ source: 'oneiroam-editor', ...msg }, PREVIEW_ORIGIN);

  // 只有在 iframe 已 ready 才推送；renderVisualEditor 載完設定與 ready 事件都會呼叫，
  // 兩者誰先到都行（避免 ready 早於 loadSettings 時預覽卡在預設值）。
  function pushRender() {
    if (!ready) return;
    post({ type: 'render', settings: draft });
    post({ type: 'theme', value: draft.theme || 'default' });
  }

  async function loadSettings() {
    const { data } = await window.sb.from('settings').select('*');
    draft = Object.fromEntries((data || []).map(r => [r.key, r.value]));
  }

  function fieldsHtml() {
    return `
      <div class="ve-panel">
        <h3>首頁內容</h3>
        ${TEXT_FIELDS.map(([k, label]) => `
          <label class="field field-wide"><span>${label}</span>
            <input id="ve_${k}" data-key="${k}" value="${escAttr(draft[k] || '')}"></label>`).join('')}
        <h3>Hero 圖</h3>
        <label class="field"><span>更換圖片</span><input id="ve_hero_file" type="file" accept="image/*"></label>
        <label class="field"><span>焦點（0-100）</span>
          <input id="ve_s_focus1" data-key="hero_focus_1" type="number" min="0" max="100" value="${escAttr(draft.hero_focus_1 || '35')}"></label>
        <h3>配色</h3>
        <div class="ve-themes">
          ${THEME_OPTIONS.map(([v, l]) => `
            <label><input type="radio" name="ve_theme" value="${v}" ${(draft.theme || 'default') === v ? 'checked' : ''}> ${l}</label>`).join('')}
        </div>
        <div class="form-actions">
          <button id="ve_save" class="btn btn-primary">儲存</button>
          <label class="ve-lang"><input type="checkbox" id="ve_lang_en"> 預覽英文</label>
          <span id="ve_msg" class="muted" role="status"></span>
          <span id="ve_err" class="err" role="alert"></span>
        </div>
      </div>`;
  }

  function wirePanel(root) {
    // 文字/焦點欄位：輸入即 patch 預覽
    root.querySelectorAll('[data-key]').forEach(inp => {
      inp.addEventListener('input', () => {
        draft[inp.dataset.key] = inp.value;
        post({ type: 'patch', key: inp.dataset.key, value: inp.value });
      });
    });
    // 主題：切換即 patch 預覽 data-theme
    root.querySelectorAll('input[name="ve_theme"]').forEach(r => {
      r.addEventListener('change', () => {
        draft.theme = r.value;
        post({ type: 'theme', value: r.value });
      });
    });
    // 語言切換
    root.querySelector('#ve_lang_en').addEventListener('change', e =>
      post({ type: 'lang', lang: e.target.checked ? 'en' : 'zh' }));
    // Hero 圖上傳：上傳後拿到 URL，patch 預覽並存進草稿
    root.querySelector('#ve_hero_file').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      const errEl = root.querySelector('#ve_err'); errEl.textContent = '';
      try {
        const url = await window.adminData.uploadImage(file, 'hero_img_1');
        draft.hero_img_1 = url;
        post({ type: 'patch', key: 'hero_img_1', value: url });
      } catch (err) { errEl.textContent = '圖片上傳失敗：' + (err.message || err); }
    });
    // 儲存
    root.querySelector('#ve_save').addEventListener('click', async () => {
      const msg = root.querySelector('#ve_msg'), errEl = root.querySelector('#ve_err');
      msg.textContent = ''; errEl.textContent = '';
      const rows = [
        ...TEXT_FIELDS.map(([k]) => ({ key: k, value: (draft[k] || '').trim() })),
        { key: 'hero_focus_1', value: String(draft.hero_focus_1 || '35').trim() },
        { key: 'theme', value: draft.theme || 'default' },
      ];
      if (draft.hero_img_1) rows.push({ key: 'hero_img_1', value: draft.hero_img_1 });
      try { await window.adminData.saveSettings(rows); msg.textContent = '✓ 已儲存，記得按「發布到網站」'; }
      catch (err) { errEl.textContent = err.message || '儲存失敗'; }
    });
  }

  window.renderVisualEditor = async () => {
    ready = false;   // 重新進入本視圖 → 新 iframe，等新的 ready
    const root = document.getElementById('viewRoot');
    root.innerHTML = `
      <div class="view-head"><h2>視覺編輯</h2><p class="muted">點左邊要改的地方 → 右邊編輯 → 儲存 → 發布</p></div>
      <div class="ve-split">
        <iframe id="ve_preview" class="ve-preview" src="admin-preview.html" title="preview"></iframe>
        <div id="ve_fields"></div>
      </div>`;
    iframe = root.querySelector('#ve_preview');
    await loadSettings();
    root.querySelector('#ve_fields').innerHTML = fieldsHtml();
    wirePanel(root);
    pushRender();   // 設定載完；若 iframe 已 ready 立即推送，否則等 ready 事件
  };

  // iframe → parent：ready 送初始草稿；select 聚焦對應欄位
  window.addEventListener('message', e => {
    if (e.origin !== PREVIEW_ORIGIN) return;
    const m = e.data || {};
    if (m.source !== 'oneiroam-preview') return;
    if (m.type === 'ready') { ready = true; pushRender(); }
    else if (m.type === 'select') {
      const fieldId = EDIT_TO_FIELD[m.editKey];
      const el = fieldId && document.getElementById('ve_' + fieldId);
      if (el) { el.focus(); el.scrollIntoView({ block: 'center' }); }
    }
  });
})();
