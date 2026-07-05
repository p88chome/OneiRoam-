// admin.js
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

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
document.querySelectorAll('.nav-item').forEach(b => b.onclick = () => {
  if (b.dataset.view === 'dashboard') renderDashboard();
  else { setActiveNav('products'); renderProducts(); }
});

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

async function productForm(p) {
  const isNew = !p;
  p = p || { id:'', name_zh:'', name_en:'', desc_zh:'', desc_en:'', category:'top',
             price:0, badge_zh:'', badge_en:'', status:'preorder', sort_order:0 };
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
          <input id="f_category" value="${esc(p.category)}"></label>
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
        <label class="field"><span>尺寸+庫存（例 小碼:20,大碼:20）</span>
          <input id="f_variants" value="${variants.map(v=>`${esc(v.size)}:${esc(v.stock)}`).join(',')}"></label>
        <label class="field field-wide"><span>商品圖片</span>
          <input id="f_image" type="file" accept="image/*"></label>
      </div>
      <div class="form-actions">
        <button id="saveBtn" class="btn btn-primary">儲存</button>
        <button id="cancelBtn" class="btn btn-ghost">取消</button>
        <span id="formErr" class="err" role="alert"></span>
      </div>
    </div>`;
  document.getElementById('cancelBtn').onclick = renderProducts;
  document.getElementById('saveBtn').onclick = () => saveProduct(isNew);
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
