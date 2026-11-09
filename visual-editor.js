// visual-editor.js — 視覺編輯視圖：左 iframe 全頁預覽、右屬性面板（網站設定 ⇄ 選中商品）、
// postMessage 橋、草稿 + 存檔/發布。依賴 admin.js 的 window.sb 與 admin-data.js 的 window.adminData。
(() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PREVIEW_ORIGIN = location.origin;

  const SITE_TEXT_FIELDS = [
    ['hero_eyebrow_zh', 'Hero 小標（中）'], ['hero_eyebrow_en', 'Hero 小標（英，可留白）'],
    ['hero_desc_zh', 'Hero 描述（中）'], ['hero_desc_en', 'Hero 描述（英，可留白）'],
  ];
  const SITE_EDIT_TO_FIELD = {
    hero_eyebrow: 'hero_eyebrow_zh', hero_desc: 'hero_desc_zh', hero_img: 's_focus1',
  };
  const THEME_OPTIONS = [
    ['default', '夢幻粉紫'], ['sage', '米綠'], ['latte', '奶茶'], ['mist', '霧藍'],
  ];
  const PRODUCT_FIELD_LABELS = [
    ['name_zh', '名稱（中）'], ['name_en', '名稱（英，可留白）'],
    ['desc_zh', '描述（中）'], ['desc_en', '描述（英，可留白）'],
    ['price', '價格 (NT$)'],
    ['badge_zh', '徽章（中，可留白）'], ['badge_en', '徽章（英，可留白）'],
  ];

  let draft = {};                 // 網站設定草稿
  let products = [];              // 商品清單
  const productDrafts = {};       // id -> 商品草稿
  const dirtyProducts = new Set();
  let iframe = null;
  let ready = false;

  const post = msg => iframe && iframe.contentWindow &&
    iframe.contentWindow.postMessage({ source: 'oneiroam-editor', ...msg }, PREVIEW_ORIGIN);

  function pushRender() {
    if (!ready) return;
    post({ type: 'render', settings: draft });
    post({ type: 'theme', value: draft.theme || 'default' });
  }

  async function loadSettings() {
    const { data } = await window.sb.from('settings').select('*');
    draft = Object.fromEntries((data || []).map(r => [r.key, r.value]));
  }
  async function loadProducts() {
    const { data } = await window.sb.from('products')
      .select('id,name_zh,name_en,desc_zh,desc_en,price,badge_zh,badge_en').order('sort_order');
    products = data || [];
    for (const p of products) if (!productDrafts[p.id]) productDrafts[p.id] = { ...p };
  }

  const fieldsRoot = () => document.getElementById('ve_fields');

  // ---- 網站設定面板 ----
  function siteFieldsHtml() {
    return `
      <div class="ve-panel">
        <h3>首頁內容</h3>
        ${SITE_TEXT_FIELDS.map(([k, label]) => `
          <label class="field field-wide"><span>${label}</span>
            <input id="ve_${k}" data-key="${k}" value="${esc(draft[k] || '')}"></label>`).join('')}
        <h3>Hero 圖</h3>
        <label class="field"><span>更換圖片</span><input id="ve_hero_file" type="file" accept="image/*"></label>
        <label class="field"><span>焦點（0-100）</span>
          <input id="ve_s_focus1" data-key="hero_focus_1" type="number" min="0" max="100" value="${esc(draft.hero_focus_1 || '35')}"></label>
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
        <p class="muted" style="margin-top:1rem">＊點左邊商品卡的文字可編輯該商品</p>
      </div>`;
  }

  function wireSitePanel(root) {
    root.querySelectorAll('[data-key]').forEach(inp => {
      inp.addEventListener('input', () => {
        draft[inp.dataset.key] = inp.value;
        post({ type: 'patch', key: inp.dataset.key, value: inp.value });
      });
    });
    root.querySelectorAll('input[name="ve_theme"]').forEach(r => {
      r.addEventListener('change', () => { draft.theme = r.value; post({ type: 'theme', value: r.value }); });
    });
    root.querySelector('#ve_lang_en').addEventListener('change', e =>
      post({ type: 'lang', lang: e.target.checked ? 'en' : 'zh' }));
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
    root.querySelector('#ve_save').addEventListener('click', async () => {
      const msg = root.querySelector('#ve_msg'), errEl = root.querySelector('#ve_err');
      msg.textContent = ''; errEl.textContent = '';
      const rows = [
        ...SITE_TEXT_FIELDS.map(([k]) => ({ key: k, value: (draft[k] || '').trim() })),
        { key: 'hero_focus_1', value: String(draft.hero_focus_1 || '35').trim() },
        { key: 'theme', value: draft.theme || 'default' },
      ];
      if (draft.hero_img_1) rows.push({ key: 'hero_img_1', value: draft.hero_img_1 });
      try { await window.adminData.saveSettings(rows); msg.textContent = '✓ 已儲存，記得按「發布到網站」'; }
      catch (err) { errEl.textContent = err.message || '儲存失敗'; }
    });
  }

  function renderSitePanel() {
    const root = fieldsRoot();
    root.innerHTML = siteFieldsHtml();
    wireSitePanel(root);
    post({ type: 'lang', lang: 'zh' }); // 面板重繪＝語言鈕回未勾(中)，同步預覽避免改中文卻看不到變化
  }

  // ---- 商品面板 ----
  function productFieldsHtml(id) {
    const d = productDrafts[id] || {};
    const row = ([k, label]) =>
      `<label class="field field-wide"><span>${label}</span>
        <input id="ve_p_${k}" data-pkey="${k}" ${k === 'price' ? 'type="number" min="0"' : ''} value="${esc(d[k] ?? '')}"></label>`;
    return `
      <div class="ve-panel">
        <button id="ve_p_back" class="btn btn-ghost btn-sm">← 回網站設定</button>
        <h3>編輯商品：${esc(d.name_zh || id)}</h3>
        ${PRODUCT_FIELD_LABELS.map(row).join('')}
        <div class="form-actions">
          <button id="ve_p_save" class="btn btn-primary">儲存商品</button>
          <label class="ve-lang"><input type="checkbox" id="ve_lang_en"> 預覽英文</label>
          <span id="ve_msg" class="muted" role="status"></span>
          <span id="ve_err" class="err" role="alert"></span>
        </div>
      </div>`;
  }

  function wireProductPanel(root, id) {
    root.querySelectorAll('[data-pkey]').forEach(inp => {
      inp.addEventListener('input', () => {
        const k = inp.dataset.pkey;
        productDrafts[id][k] = inp.value;
        dirtyProducts.add(id);
        post({ type: 'patch', scope: 'product', productId: id, key: k, value: inp.value });
      });
    });
    root.querySelector('#ve_lang_en').addEventListener('change', e =>
      post({ type: 'lang', lang: e.target.checked ? 'en' : 'zh' }));
    root.querySelector('#ve_p_back').addEventListener('click', () => renderSitePanel());
    root.querySelector('#ve_p_save').addEventListener('click', async () => {
      const msg = root.querySelector('#ve_msg'), errEl = root.querySelector('#ve_err');
      msg.textContent = ''; errEl.textContent = '';
      try {
        for (const pid of [...dirtyProducts]) {
          const d = productDrafts[pid];
          const price = parseInt(d.price, 10);
          if (!Number.isFinite(price) || price < 0) { errEl.textContent = '價格需為 0 或正整數'; return; }
          await window.adminData.saveProduct(pid, {
            name_zh: (d.name_zh || '').trim(), name_en: (d.name_en || '').trim(),
            desc_zh: (d.desc_zh || '').trim(), desc_en: (d.desc_en || '').trim(),
            badge_zh: (d.badge_zh || '').trim(), badge_en: (d.badge_en || '').trim(),
            price,
          });
          dirtyProducts.delete(pid);
        }
        msg.textContent = '✓ 已儲存，記得按「發布到網站」';
      } catch (err) { errEl.textContent = err.message || '儲存失敗'; }
    });
  }

  function renderProductPanel(id) {
    if (!productDrafts[id]) productDrafts[id] = { id };
    const root = fieldsRoot();
    root.innerHTML = productFieldsHtml(id);
    wireProductPanel(root, id);
    post({ type: 'lang', lang: 'zh' }); // 同 renderSitePanel：面板語言鈕與預覽同步為中
  }

  window.renderVisualEditor = async () => {
    ready = false;
    const root = document.getElementById('viewRoot');
    root.innerHTML = `
      <div class="view-head"><h2>視覺編輯</h2><p class="muted">點左邊要改的地方 → 右邊編輯 → 儲存 → 發布</p></div>
      <div class="ve-split">
        <iframe id="ve_preview" class="ve-preview" src="admin-preview.html" title="preview"></iframe>
        <div id="ve_fields"></div>
      </div>`;
    iframe = root.querySelector('#ve_preview');
    await Promise.all([loadSettings(), loadProducts()]);
    renderSitePanel();
    pushRender();
  };

  window.addEventListener('message', e => {
    if (e.origin !== PREVIEW_ORIGIN) return;
    const m = e.data || {};
    if (m.source !== 'oneiroam-preview') return;
    if (m.type === 'ready') { ready = true; pushRender(); }
    else if (m.type === 'select') {
      if (m.scope === 'product') {
        renderProductPanel(m.productId);
        const focusId = 've_p_' + (m.field === 'price' ? 'price' : m.field + '_zh');
        const el = document.getElementById(focusId);
        if (el) { el.focus(); el.scrollIntoView({ block: 'center' }); }
      } else {
        renderSitePanel();
        const fieldId = SITE_EDIT_TO_FIELD[m.editKey];
        const el = fieldId && document.getElementById('ve_' + fieldId);
        if (el) { el.focus(); el.scrollIntoView({ block: 'center' }); }
      }
    }
  });
})();
