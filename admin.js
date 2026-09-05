// admin.js
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// 與 scripts/categories.mjs 的 CATEGORIES 同步（瀏覽器端無法 import ESM 建置模組）
const CATEGORY_OPTIONS = [
  ['puff', '澎袖'], ['collar', '領片'], ['set', '套裝'], ['top', '上衣'],
  ['bottom', '下著'], ['accessory', '其他配件'], ['select_top', '選品・上衣'], ['select_bottom', '選品・下著'], ['select_acc', '選品・配件'],
];
function categoryOptions(current) {
  const opts = CATEGORY_OPTIONS.map(([v, l]) =>
    `<option value="${v}" ${v === current ? 'selected' : ''}>${l}</option>`);
  // 舊分類值保留為選項，避免編輯舊商品時被靜默改掉
  if (current && !CATEGORY_OPTIONS.some(([v]) => v === current))
    opts.unshift(`<option value="${esc(current)}" selected>${esc(current)}（舊分類）</option>`);
  return opts.join('');
}

// ---- 開機防呆：函式庫 / 設定沒載到就明白告知，而非靜默失效 ----
function bootFail(msg) {
  const el = document.getElementById('bootError');
  el.hidden = false;
  el.textContent = '⚠ ' + msg;
  document.getElementById('loginView').hidden = true;
}
if (!window.supabase || typeof window.supabase.createClient !== 'function') {
  bootFail('無法載入 Supabase 函式庫，請檢查網路或廣告攔截器，重新整理頁面。');
  throw new Error('supabase-js not loaded');
}
if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
  bootFail('缺少 Supabase 設定（admin.config.js），請聯絡開發者。');
  throw new Error('missing supabase config');
}

const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
window.sb = sb;

// 友善錯誤訊息（把 Supabase 英文錯誤轉中文常見情境）
function friendlyErr(error) {
  const m = (error && error.message || '').toLowerCase();
  if (m.includes('invalid login')) return '帳號或密碼錯誤。';
  if (m.includes('email not confirmed')) return '此帳號尚未確認 Email。請在 Supabase 後台將帳號設為已確認（Add user 時勾 Auto Confirm）。';
  if (m.includes('failed to fetch') || m.includes('network')) return '連線失敗，請檢查網路。';
  return error && error.message || '發生未知錯誤。';
}

const loginView = document.getElementById('loginView');
const adminApp = document.getElementById('adminApp');

async function refreshAuth() {
  const { data } = await sb.auth.getSession();
  const ok = !!data.session;
  loginView.hidden = ok;
  adminApp.hidden = !ok;
  if (ok) renderDashboard();
}

// 登入：用 form submit，Enter 也能送；按鈕 loading 狀態
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  loginError.textContent = '';
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  if (!email || !password) { loginError.textContent = '請輸入 Email 與密碼。'; return; }
  loginBtn.disabled = true;
  const orig = loginBtn.textContent;
  loginBtn.textContent = '登入中…';
  try {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { loginError.textContent = friendlyErr(error); return; }
    await refreshAuth();
  } catch (err) {
    loginError.textContent = friendlyErr(err);
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = orig;
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await sb.auth.signOut(); refreshAuth();
});

const publishBtn = document.getElementById('publishBtn');
publishBtn.onclick = async () => {
  const msg = document.getElementById('publishMsg');
  publishBtn.disabled = true;
  msg.textContent = '發布中…';
  try {
    // 經 trigger-deploy 代理觸發（server 端 POST hook：避開 CORS、hook 不進瀏覽器）
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { msg.textContent = '請重新登入'; return; }
    const res = await fetch(`${window.SUPABASE_URL}/functions/v1/trigger-deploy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': window.SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const out = await res.json();
    if (!res.ok || out.error) {
      msg.textContent = out.error === 'hook not configured' ? '未設定 deploy hook' : '發布失敗';
      return;
    }
    msg.textContent = '✓ 已觸發發布，數分鐘後生效';
  } catch {
    msg.textContent = '發布失敗';
  } finally {
    publishBtn.disabled = false;
  }
};

const viewRoot = () => document.getElementById('viewRoot');

function setActiveNav(view) {
  document.querySelectorAll('.nav-item').forEach(b =>
    b.classList.toggle('active', b.dataset.view === view));
}
const VIEWS = {
  dashboard: renderDashboard,
  products: () => { setActiveNav('products'); renderProducts(); },
  orders: () => { setActiveNav('orders'); renderOrders(); },
  discounts: () => { setActiveNav('discounts'); renderDiscounts(); },
  site: renderSiteSettings,
};
document.querySelectorAll('.nav-item').forEach(b => b.onclick = () => (VIEWS[b.dataset.view] || renderDashboard)());

async function renderDashboard() {
  setActiveNav('dashboard');
  const [pRes, vRes, sRes] = await Promise.all([
    sb.from('products').select('*').order('sort_order'),
    sb.from('product_variants').select('*'),
    sb.from('settings').select('*'),
  ]);
  const err = pRes.error || vRes.error || sRes.error;
  if (err) { viewRoot().innerHTML = `<p class="err">讀取失敗：${esc(err.message)}</p>`; return; }
  const settings = Object.fromEntries((sRes.data || []).map(s => [s.key, s.value]));
  const st = window.computeDashboardStats(pRes.data, vRes.data, settings, new Date());
  const banner = st.window === 'before'
    ? `預售尚未開始（${esc(settings.preorder_start || '')} 起）`
    : st.window === 'after' ? '預售已結束'
    : st.daysLeft != null ? `預售中 · 倒數 ${esc(st.daysLeft)} 天` : '預售中';
  viewRoot().innerHTML = `
    <div class="view-head"><h2>總覽</h2></div>
    <div class="banner banner-${esc(st.window)}">${banner}</div>
    <div class="stat-grid">
      <div class="stat-card"><span class="stat-num">${esc(st.total)}</span><span class="stat-label">商品總數</span></div>
      <div class="stat-card"><span class="stat-num">${esc(st.preorder)}</span><span class="stat-label">預購中</span></div>
      <div class="stat-card"><span class="stat-num">${esc(st.soldOut)}</span><span class="stat-label">售罄</span></div>
      <div class="stat-card"><span class="stat-num">${esc(st.lowStockCount)}</span><span class="stat-label">低庫存款式</span></div>
    </div>
    <div class="view-head"><h3>低庫存提醒</h3></div>
    <div class="card">
      ${st.lowStockList.length ? `<table class="data-table">
        <thead><tr><th>商品</th><th>尺寸</th><th>庫存</th></tr></thead>
        <tbody>${st.lowStockList.map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.size)}</td><td>${esc(r.stock)}</td></tr>`).join('')}</tbody>
      </table>` : `<p class="muted" style="padding:1rem">庫存充足 ✓</p>`}
    </div>
    <div class="view-head"><h3>即將推出</h3></div>
    <div class="stat-grid">
      <div class="stat-card soon"><span class="stat-num">—</span><span class="stat-label">本月訂單</span></div>
      <div class="stat-card soon"><span class="stat-num">—</span><span class="stat-label">待付款</span></div>
      <div class="stat-card soon"><span class="stat-num">—</span><span class="stat-label">營收</span></div>
      <div class="stat-card soon"><span class="stat-num">—</span><span class="stat-label">流量</span></div>
    </div>
    <div class="form-actions" style="border:none">
      <button id="dashNew" class="btn btn-primary">＋ 新增商品</button>
      <button id="dashPublish" class="btn btn-accent">發布到網站</button>
    </div>`;
  document.getElementById('dashNew').onclick = () => { setActiveNav('products'); productForm(null); };
  document.getElementById('dashPublish').onclick = () => publishBtn.click();
}

const PAY_STATUS_LABEL = { pending: '待付款', paid: '已付款', failed: '付款失敗' };
const FULFILL_LABEL = { unfulfilled: '未出貨', shipped: '已出貨' };

async function renderOrders() {
  const { data: orders, error } = await sb.from('orders')
    .select('id, order_no, name, phone, email, total, pay_amount, payment_status, fulfillment_status, discount_code, created_at')
    .order('created_at', { ascending: false }).limit(200);
  if (error) { viewRoot().innerHTML = `<p class="err">讀取失敗：${esc(error.message)}</p>`; return; }
  viewRoot().innerHTML = `
    <div class="view-head"><h2>訂單管理</h2></div>
    <div class="card">
      <table class="data-table">
        <thead><tr><th>訂單編號</th><th>客人</th><th>金額</th><th>付款</th><th>出貨</th><th>時間</th><th></th></tr></thead>
        <tbody>${orders.map(o => `
          <tr>
            <td>${esc(o.order_no)}${o.discount_code ? ` <span class="muted">(${esc(o.discount_code)})</span>` : ''}</td>
            <td>${esc(o.name)}<br><span class="muted">${esc(o.phone)}</span></td>
            <td>NT$ ${esc(Number(o.pay_amount).toLocaleString('en-US'))}<br><span class="muted">合計 ${esc(Number(o.total).toLocaleString('en-US'))}</span></td>
            <td><span class="badge badge-${esc(o.payment_status)}">${esc(PAY_STATUS_LABEL[o.payment_status] || o.payment_status)}</span></td>
            <td><span class="badge">${esc(FULFILL_LABEL[o.fulfillment_status] || o.fulfillment_status)}</span></td>
            <td class="muted">${esc((o.created_at || '').slice(0, 16).replace('T', ' '))}</td>
            <td>${o.fulfillment_status !== 'shipped'
              ? `<button class="btn btn-sm" data-ship="${esc(o.id)}">標記已出貨</button>` : ''}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  viewRoot().querySelectorAll('[data-ship]').forEach(b => b.onclick = async () => {
    b.disabled = true; b.textContent = '處理中…';
    const { error } = await sb.from('orders').update({ fulfillment_status: 'shipped' }).eq('id', b.dataset.ship);
    if (error) { b.disabled = false; b.textContent = '標記已出貨'; alert('更新失敗：' + error.message); return; }
    renderOrders();
  });
}

async function renderDiscounts() {
  const { data: codes, error } = await sb.from('discount_codes').select('*').order('created_at', { ascending: false });
  if (error) { viewRoot().innerHTML = `<p class="err">讀取失敗：${esc(error.message)}</p>`; return; }
  viewRoot().innerHTML = `
    <div class="view-head">
      <h2>折扣碼</h2>
      <button id="newCodeBtn" class="btn btn-primary">＋ 新增折扣碼</button>
    </div>
    <div class="card form-card">
      <div class="form-grid">
        <label class="field"><span>代碼（客人輸入，大寫英數）</span>
          <input id="dc_code" style="text-transform:uppercase" maxlength="30" placeholder="例：WELCOME10"></label>
        <label class="field"><span>折扣％（跟固定折抵擇一）</span>
          <input id="dc_percent" type="number" min="1" max="100" placeholder="例：10"></label>
        <label class="field"><span>固定折抵 NT$（跟折扣％擇一）</span>
          <input id="dc_amount" type="number" min="1" placeholder="例：100"></label>
        <label class="field"><span>使用上限（留白＝不限）</span>
          <input id="dc_max" type="number" min="1"></label>
        <label class="field"><span>到期日（留白＝不過期）</span>
          <input id="dc_expires" type="date"></label>
      </div>
      <div class="form-actions">
        <button id="dcSaveBtn" class="btn btn-primary">新增</button>
        <span id="dcErr" class="err" role="alert"></span>
      </div>
    </div>
    <div class="card">
      <table class="data-table">
        <thead><tr><th>代碼</th><th>折扣</th><th>已用/上限</th><th>到期</th><th>狀態</th><th></th></tr></thead>
        <tbody>${codes.map(c => `
          <tr>
            <td>${esc(c.code)}</td>
            <td>${c.percent_off ? esc(c.percent_off) + '%' : 'NT$ ' + esc(c.amount_off)}</td>
            <td>${esc(c.used_count)} / ${c.max_uses ?? '∞'}</td>
            <td class="muted">${c.expires_at ? esc(String(c.expires_at).slice(0, 10)) : '—'}</td>
            <td><span class="badge badge-${c.active ? 'active' : 'hidden'}">${c.active ? '啟用中' : '已停用'}</span></td>
            <td><button class="btn btn-sm" data-toggle="${esc(c.code)}" data-active="${c.active}">${c.active ? '停用' : '啟用'}</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  document.getElementById('newCodeBtn').onclick = () => document.getElementById('dc_code').focus();
  document.getElementById('dcSaveBtn').onclick = async () => {
    const errEl = document.getElementById('dcErr');
    errEl.textContent = '';
    const code = document.getElementById('dc_code').value.trim().toUpperCase();
    const percent = document.getElementById('dc_percent').value.trim();
    const amount = document.getElementById('dc_amount').value.trim();
    if (!code) { errEl.textContent = '請輸入代碼。'; return; }
    if (!percent && !amount) { errEl.textContent = '折扣％與固定折抵至少填一個。'; return; }
    const row = {
      code, active: true,
      percent_off: percent ? parseInt(percent, 10) : null,
      amount_off: amount ? parseInt(amount, 10) : null,
      max_uses: document.getElementById('dc_max').value.trim() ? parseInt(document.getElementById('dc_max').value, 10) : null,
      expires_at: document.getElementById('dc_expires').value || null,
    };
    const { error } = await sb.from('discount_codes').insert(row);
    if (error) { errEl.textContent = friendlyErr(error); return; }
    renderDiscounts();
  };
  viewRoot().querySelectorAll('[data-toggle]').forEach(b => b.onclick = async () => {
    const active = b.dataset.active !== 'true';
    const { error } = await sb.from('discount_codes').update({ active }).eq('code', b.dataset.toggle);
    if (error) { alert('更新失敗：' + error.message); return; }
    renderDiscounts();
  });
}

const STATUS_LABEL = { preorder: '預購中', active: '現貨', sold_out: '售罄', hidden: '隱藏' };

async function renderProducts() {
  const { data: products, error } = await sb.from('products').select('*').order('sort_order');
  if (error) { viewRoot().innerHTML = `<p class="err">讀取失敗：${esc(error.message)}</p>`; return; }
  viewRoot().innerHTML = `
    <div class="view-head">
      <h2>商品管理</h2>
      <button id="newBtn" class="btn btn-primary">＋ 新增商品</button>
    </div>
    <div class="card">
      <table class="data-table">
        <thead><tr><th>排序</th><th>名稱</th><th>價格</th><th>狀態</th><th></th></tr></thead>
        <tbody>${products.map(p => `
          <tr>
            <td class="muted">${esc(p.sort_order)}</td>
            <td>${esc(p.name_zh)}</td>
            <td>NT$ ${esc(Number(p.price).toLocaleString('en-US'))}</td>
            <td><span class="badge badge-${esc(p.status)}">${esc(STATUS_LABEL[p.status] || p.status)}</span></td>
            <td><button class="btn btn-sm" data-edit="${esc(p.id)}">編輯</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  document.getElementById('newBtn').onclick = () => productForm(null);
  viewRoot().querySelectorAll('[data-edit]').forEach(b =>
    b.onclick = () => productForm(products.find(p => p.id === b.dataset.edit)));
}

// 與 scripts/site-settings.mjs 的 THEMES 同步
const THEME_OPTIONS = [
  ['default', '夢幻粉紫（現行）', ['#FAFAF7', '#E0CDD5', '#C4A882']],
  ['sage',    '米綠',            ['#F5F4EA', '#C9D0B5', '#9A9160']],
  ['latte',   '奶茶',            ['#FAF6F0', '#D8C2AC', '#A8845C']],
  ['mist',    '霧藍',            ['#F5F7F8', '#C2CED8', '#7A8FA0']],
];
const SITE_TEXT_FIELDS = [
  ['announce_zh', '公告列（中）'], ['announce_en', '公告列（英，可留白）'],
  ['hero_eyebrow_zh', '首圖上方小標（中）'], ['hero_eyebrow_en', '首圖上方小標（英，可留白）'],
  ['hero_desc_zh', '首圖描述（中）'], ['hero_desc_en', '首圖描述（英，可留白）'],
];

async function renderSiteSettings() {
  setActiveNav('site');
  const { data, error } = await sb.from('settings').select('*');
  if (error) { viewRoot().innerHTML = `<p class="err">讀取失敗：${esc(error.message)}</p>`; return; }
  const s = Object.fromEntries((data || []).map(r => [r.key, r.value]));
  const theme = s.theme || 'default';
  viewRoot().innerHTML = `
    <div class="view-head"><h2>網站設定</h2></div>
    <div class="card form-card">
      <h3>首圖 Banner</h3>
      <p class="muted">建議橫式照片；直式照片可用「焦點」調整裁切位置（0=頂、100=底）。存檔後按「發布到網站」才會生效。</p>
      <div class="form-grid">
        <label class="field"><span>Banner 圖（現用：${esc(s.hero_img_1 || '內建')}）</span>
          <input id="s_hero1" type="file" accept="image/*"></label>
        <label class="field"><span>焦點（0-100，預設 35）</span>
          <input id="s_focus1" type="number" min="0" max="100" value="${esc(s.hero_focus_1 || '35')}"></label>
      </div>
      <h3>配色主題</h3>
      <div class="theme-row">
        ${THEME_OPTIONS.map(([v, label, sw]) => `
          <label class="theme-opt">
            <input type="radio" name="s_theme" value="${v}" ${v === theme ? 'checked' : ''}>
            <span class="swatches">${sw.map(c => `<i style="background:${c}"></i>`).join('')}</span>
            <span>${label}</span>
          </label>`).join('')}
      </div>
      <h3>文字</h3>
      <div class="form-grid">
        ${SITE_TEXT_FIELDS.map(([k, label]) => `
          <label class="field field-wide"><span>${label}</span>
            <input id="s_${k}" value="${esc(s[k] || '')}" placeholder="留白＝用內建文案"></label>`).join('')}
      </div>
      <div class="form-actions">
        <button id="siteSaveBtn" class="btn btn-primary">儲存</button>
        <span id="siteMsg" class="muted" role="status"></span>
        <span id="siteErr" class="err" role="alert"></span>
      </div>
    </div>`;
  document.getElementById('siteSaveBtn').onclick = saveSiteSettings;
}

async function saveSiteSettings() {
  const btn = document.getElementById('siteSaveBtn');
  const msg = document.getElementById('siteMsg');
  const errEl = document.getElementById('siteErr');
  errEl.textContent = ''; msg.textContent = '';
  btn.disabled = true; btn.textContent = '儲存中…';
  const fail = m => { errEl.textContent = m; btn.disabled = false; btn.textContent = '儲存'; };
  try {
    const rows = [];
    // 圖片上傳（有選檔才傳）
    for (const [inputId, key] of [['s_hero1', 'hero_img_1']]) {
      const file = document.getElementById(inputId).files[0];
      if (!file) continue;
      try {
        rows.push({ key, value: await window.adminData.uploadImage(file, key) });
      } catch (e) { return fail('圖片上傳失敗：' + friendlyErr(e)); }
    }
    rows.push({ key: 'hero_focus_1', value: document.getElementById('s_focus1').value.trim() });
    rows.push({ key: 'theme', value: (document.querySelector('input[name="s_theme"]:checked') || {}).value || 'default' });
    for (const [k] of SITE_TEXT_FIELDS)
      rows.push({ key: k, value: document.getElementById(`s_${k}`).value.trim() });
    try { await window.adminData.saveSettings(rows); } catch (e) { return fail(friendlyErr(e)); }
    msg.textContent = '✓ 已儲存，記得按「發布到網站」';
    btn.disabled = false; btn.textContent = '儲存';
  } catch (e) {
    fail(friendlyErr(e));
  }
}

async function productForm(p) {
  const isNew = !p;
  p = p || { id:'', name_zh:'', name_en:'', desc_zh:'', desc_en:'', category:'top',
             price:0, badge_zh:'', badge_en:'', status:'preorder', sort_order:0,
             needs_shipping:true };
  let variants = [];
  if (!isNew) {
    const { data } = await sb.from('product_variants').select('*').eq('product_id', p.id);
    variants = data || [];
  }
  viewRoot().innerHTML = `
    <div class="view-head"><h2>${isNew ? '新增商品' : '編輯商品'}</h2></div>
    <div class="card form-card">
      <div class="form-grid">
        <label class="field"><span>ID（slug，英數-）</span>
          <input id="f_id" value="${esc(p.id)}" ${isNew ? '' : 'disabled'}></label>
        <label class="field"><span>分類</span>
          <select id="f_category">${categoryOptions(p.category)}</select></label>
        <label class="field"><span>中文名</span>
          <input id="f_name_zh" value="${esc(p.name_zh)}"></label>
        <label class="field"><span>英文名</span>
          <input id="f_name_en" value="${esc(p.name_en)}"></label>
        <label class="field field-wide"><span>中文描述</span>
          <input id="f_desc_zh" value="${esc(p.desc_zh)}"></label>
        <label class="field field-wide"><span>英文描述</span>
          <input id="f_desc_en" value="${esc(p.desc_en)}"></label>
        <label class="field"><span>價格 (NT$)</span>
          <input id="f_price" type="number" value="${esc(p.price)}"></label>
        <label class="field"><span>排序</span>
          <input id="f_sort" type="number" value="${esc(p.sort_order)}"></label>
        <label class="field"><span>徽章（中）</span>
          <input id="f_badge_zh" value="${esc(p.badge_zh)}"></label>
        <label class="field"><span>徽章（英）</span>
          <input id="f_badge_en" value="${esc(p.badge_en)}"></label>
        <label class="field"><span>狀態</span>
          <select id="f_status">${['preorder','active','sold_out','hidden']
            .map(s => `<option value="${s}" ${s===p.status?'selected':''}>${STATUS_LABEL[s]}</option>`).join('')}</select></label>
        <label class="field"><span>需要物流（尾款商品貨到付款打勾；訂金商品免物流取消勾選）</span>
          <input id="f_needs_shipping" type="checkbox" ${p.needs_shipping ? 'checked' : ''}></label>
        <label class="field"><span>尺寸+庫存（例 小碼:20,大碼:20）</span>
          <input id="f_variants" value="${variants.map(v=>`${esc(v.size)}:${esc(v.stock)}`).join(',')}"></label>
        <label class="field field-wide"><span>商品圖片</span>
          <input id="f_image" type="file" accept="image/*"></label>
      </div>
      <div class="form-actions">
        <button id="saveBtn" class="btn btn-primary">儲存</button>
        <button id="cancelBtn" class="btn btn-ghost">取消</button>
        ${isNew ? '' : '<button id="deleteBtn" class="btn btn-danger">刪除商品</button>'}
        <span id="formErr" class="err" role="alert"></span>
      </div>
    </div>`;
  document.getElementById('cancelBtn').onclick = renderProducts;
  document.getElementById('saveBtn').onclick = () => saveProduct(isNew);
  if (!isNew) document.getElementById('deleteBtn').onclick = () => deleteProduct(p);
}

async function deleteProduct(p) {
  // 永久刪除：variants/images 由 DB cascade 帶走；order_items 是文字快照不受影響。
  // 暫時下架請改用狀態「隱藏」。
  if (!confirm(`確定永久刪除「${p.name_zh || p.id}」？\n\n訂單紀錄不受影響，但商品無法復原。\n若只是暫時下架，請改用狀態「隱藏」。`)) return;
  const btn = document.getElementById('deleteBtn');
  const formErr = document.getElementById('formErr');
  btn.disabled = true;
  btn.textContent = '刪除中…';
  const { error } = await sb.from('products').delete().eq('id', p.id);
  if (error) {
    formErr.textContent = friendlyErr(error);
    btn.disabled = false;
    btn.textContent = '刪除商品';
    return;
  }
  renderProducts();
}

async function saveProduct(isNew) {
  const v = id => document.getElementById(id).value.trim();
  const formErr = document.getElementById('formErr');
  const saveBtn = document.getElementById('saveBtn');
  formErr.textContent = '';
  if (!v('f_id')) { formErr.textContent = '請填 ID（slug）。'; return; }
  saveBtn.disabled = true;
  const orig = saveBtn.textContent;
  saveBtn.textContent = '儲存中…';
  const fail = m => { formErr.textContent = m; saveBtn.disabled = false; saveBtn.textContent = orig; };
  const row = {
    id: v('f_id'), name_zh: v('f_name_zh'), name_en: v('f_name_en'),
    desc_zh: v('f_desc_zh'), desc_en: v('f_desc_en'), category: v('f_category'),
    price: parseInt(v('f_price'),10)||0, badge_zh: v('f_badge_zh'), badge_en: v('f_badge_en'),
    status: v('f_status'), sort_order: parseInt(v('f_sort'),10)||0,
    needs_shipping: document.getElementById('f_needs_shipping').checked,
  };
  const { error } = await sb.from('products').upsert(row);
  if (error) return fail(friendlyErr(error));
  // 重建 variants：先刪後插
  await sb.from('product_variants').delete().eq('product_id', row.id);
  const vars = v('f_variants').split(',').filter(Boolean).map(s => {
    const [size, stock] = s.split(':');
    return { product_id: row.id, size: (size||'').trim(), stock: parseInt(stock,10)||0, max_qty: 1 };
  });
  if (vars.length) {
    const { error: varErr } = await sb.from('product_variants').insert(vars);
    if (varErr) return fail(friendlyErr(varErr));
  }
  // 圖片上傳
  const file = document.getElementById('f_image').files[0];
  if (file) {
    const path = `${row.id}-${Date.now()}.${file.name.split('.').pop()}`;
    const up = await sb.storage.from('product-images').upload(path, file, { upsert: true });
    if (up.error) return fail('圖片上傳失敗：' + friendlyErr(up.error));
    const { data: pub } = sb.storage.from('product-images').getPublicUrl(path);
    await sb.from('product_images').delete().eq('product_id', row.id);
    const { error: imgErr } = await sb.from('product_images').insert({ product_id: row.id, url: pub.publicUrl, sort_order: 0 });
    if (imgErr) return fail(friendlyErr(imgErr));
  }
  renderProducts();
}

refreshAuth();
