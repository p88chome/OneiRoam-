// admin.js
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
window.sb = sb;

const loginView = document.getElementById('loginView');
const adminApp = document.getElementById('adminApp');

async function refreshAuth() {
  const { data } = await sb.auth.getSession();
  const ok = !!data.session;
  loginView.hidden = ok;
  adminApp.hidden = !ok;
  if (ok) renderProducts();
}

document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  document.getElementById('loginError').textContent = error ? '登入失敗：' + error.message : '';
  if (!error) refreshAuth();
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await sb.auth.signOut(); refreshAuth();
});

document.getElementById('publishBtn').onclick = async () => {
  const msg = document.getElementById('publishMsg');
  msg.textContent = '發布中…';
  const { data } = await sb.from('settings').select('value').eq('key', 'deploy_hook_url').single();
  if (!data?.value) { msg.textContent = '未設定 deploy hook'; return; }
  try {
    await fetch(data.value, { method: 'POST' });
    msg.textContent = '已觸發發布，數分鐘後生效';
  } catch { msg.textContent = '發布失敗'; }
};

const viewRoot = () => document.getElementById('viewRoot');

async function renderProducts() {
  const { data: products, error } = await sb.from('products').select('*').order('sort_order');
  if (error) { viewRoot().textContent = '讀取失敗：' + error.message; return; }
  viewRoot().innerHTML = `
    <button id="newBtn">+ 新增商品</button>
    <table><thead><tr><th>排序</th><th>名稱</th><th>價格</th><th>狀態</th><th></th></tr></thead>
    <tbody>${products.map(p => `
      <tr><td>${esc(p.sort_order)}</td><td>${esc(p.name_zh)}</td><td>NT$ ${esc(p.price)}</td>
      <td>${esc(p.status)}</td><td><button data-edit="${esc(p.id)}">編輯</button></td></tr>`).join('')}
    </tbody></table>`;
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
    <h2>${isNew ? '新增' : '編輯'}商品</h2>
    <label>ID(slug)<input id="f_id" value="${esc(p.id)}" ${isNew ? '' : 'disabled'}></label><br>
    <label>中文名<input id="f_name_zh" value="${esc(p.name_zh)}"></label><br>
    <label>英文名<input id="f_name_en" value="${esc(p.name_en)}"></label><br>
    <label>中文描述<input id="f_desc_zh" value="${esc(p.desc_zh)}"></label><br>
    <label>分類<input id="f_category" value="${esc(p.category)}"></label><br>
    <label>價格<input id="f_price" type="number" value="${esc(p.price)}"></label><br>
    <label>徽章(中)<input id="f_badge_zh" value="${esc(p.badge_zh)}"></label><br>
    <label>狀態
      <select id="f_status">${['preorder','active','sold_out','hidden']
        .map(s => `<option ${s===p.status?'selected':''}>${s}</option>`).join('')}</select></label><br>
    <label>排序<input id="f_sort" type="number" value="${esc(p.sort_order)}"></label><br>
    <label>尺寸+庫存(格式 小碼:20,大碼:20)
      <input id="f_variants" value="${variants.map(v=>`${esc(v.size)}:${esc(v.stock)}`).join(',')}"></label><br>
    <label>商品圖片<input id="f_image" type="file" accept="image/*"></label><br>
    <button id="saveBtn">儲存</button> <button id="cancelBtn">取消</button>
    <p class="err" id="formErr"></p>`;
  document.getElementById('cancelBtn').onclick = renderProducts;
  document.getElementById('saveBtn').onclick = () => saveProduct(isNew);
}

async function saveProduct(isNew) {
  const v = id => document.getElementById(id).value.trim();
  const row = {
    id: v('f_id'), name_zh: v('f_name_zh'), name_en: v('f_name_en'),
    desc_zh: v('f_desc_zh'), category: v('f_category'),
    price: parseInt(v('f_price'),10)||0, badge_zh: v('f_badge_zh'),
    status: v('f_status'), sort_order: parseInt(v('f_sort'),10)||0,
  };
  const { error } = await sb.from('products').upsert(row);
  if (error) { document.getElementById('formErr').textContent = error.message; return; }
  // 重建 variants：先刪後插
  await sb.from('product_variants').delete().eq('product_id', row.id);
  const vars = v('f_variants').split(',').filter(Boolean).map(s => {
    const [size, stock] = s.split(':');
    return { product_id: row.id, size: size.trim(), stock: parseInt(stock,10)||0, max_qty: 1 };
  });
  if (vars.length) {
    const { error: varErr } = await sb.from('product_variants').insert(vars);
    if (varErr) { document.getElementById('formErr').textContent = varErr.message; return; }
  }
  // 圖片上傳
  const file = document.getElementById('f_image').files[0];
  if (file) {
    const path = `${row.id}-${Date.now()}.${file.name.split('.').pop()}`;
    const up = await sb.storage.from('product-images').upload(path, file, { upsert: true });
    if (!up.error) {
      const { data: pub } = sb.storage.from('product-images').getPublicUrl(path);
      await sb.from('product_images').delete().eq('product_id', row.id);
      const { error: imgErr } = await sb.from('product_images').insert({ product_id: row.id, url: pub.publicUrl, sort_order: 0 });
      if (imgErr) { document.getElementById('formErr').textContent = imgErr.message; return; }
    }
  }
  renderProducts();
}

refreshAuth();
