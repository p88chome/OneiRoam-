document.addEventListener('DOMContentLoaded', () => {
  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---- 會員：Google 登入 → 自動帶入，下單後回存 ---- */
  const sbClient = (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY)
    ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY,
        { auth: { flowType: 'pkce' } })  // token 不進網址 hash
    : null;

  const memberEls = () => ({
    box: document.getElementById('memberBox'),
    loginBtn: document.getElementById('googleLoginBtn'),
    info: document.getElementById('memberInfo'),
    email: document.getElementById('memberEmail'),
    logoutBtn: document.getElementById('logoutBtn'),
  });

  // 只填空欄位，不覆蓋客人已輸入的內容
  function prefillForm(profile) {
    if (!profile) return;
    const form = document.getElementById('orderForm');
    for (const k of ['name', 'social', 'email']) {
      const input = form.elements[k];
      if (input && !input.value.trim() && profile[k]) input.value = profile[k];
    }
  }

  async function refreshMemberUI() {
    if (!sbClient) return;
    const els = memberEls();
    if (!els.box) return;
    const { data: { session } } = await sbClient.auth.getSession();
    if (!session) {
      els.loginBtn.style.display = '';
      els.info.style.display = 'none';
      return;
    }
    els.loginBtn.style.display = 'none';
    els.info.style.display = '';
    els.email.textContent = session.user.email || '';
    const { data: profile } = await sbClient
      .from('customer_profiles').select('*').eq('user_id', session.user.id).maybeSingle();
    prefillForm(profile);
    // 還沒有會員資料（第一次下單）→ Email 先用 Google 帳號的
    const emailInput = document.getElementById('orderForm').elements.email;
    if (emailInput && !emailInput.value.trim() && session.user.email)
      emailInput.value = session.user.email;
  }

  async function saveProfile(fields) {
    if (!sbClient) return;
    try {
      // 最多等 4 秒：網路卡住也不能拖住付款跳轉
      await Promise.race([
        (async () => {
          const { data: { session } } = await sbClient.auth.getSession();
          if (!session) return;
          await sbClient.from('customer_profiles').upsert({
            user_id: session.user.id,
            name: fields.name, social: fields.social, email: fields.email,
            updated_at: new Date().toISOString(),
          });
        })(),
        new Promise(resolve => setTimeout(resolve, 4000)),
      ]);
    } catch (e) {
      console.warn('profile save skipped:', e);  // 存檔失敗絕不擋付款
    }
  }

  if (sbClient) {
    const els = memberEls();
    if (els.loginBtn) els.loginBtn.addEventListener('click', () => {
      sbClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/order.html' },
      });
    });
    if (els.logoutBtn) els.logoutBtn.addEventListener('click', async () => {
      await sbClient.auth.signOut();
      refreshMemberUI();
    });
    refreshMemberUI();
  }

  /* 語言（與首頁同套） */
  let currentLang = localStorage.getItem('oneiRoamLang') || 'zh';
  function applyLang(lang) {
    currentLang = lang;
    document.documentElement.lang = lang === 'zh' ? 'zh-TW' : 'en';
    document.body.setAttribute('data-lang', lang);
    document.querySelectorAll('[data-zh]').forEach(el => {
      const t = lang === 'zh' ? el.dataset.zh : el.dataset.en;
      if (t !== undefined) el.textContent = t;
    });
    document.querySelectorAll('.l-zh').forEach(el => el.classList.toggle('active', lang === 'zh'));
    document.querySelectorAll('.l-en').forEach(el => el.classList.toggle('active', lang === 'en'));
    localStorage.setItem('oneiRoamLang', lang);
  }
  document.getElementById('langToggle').addEventListener('click',
    () => { applyLang(currentLang === 'zh' ? 'en' : 'zh'); render(); applyGate(); });

  /* 預售日期閘門 */
  const PREORDER_START = '2026-06-23';
  // TEMP for PAYUNi testing — extended so today falls inside the window.
  // TODO before go-live: restore the real preorder window (was '2026-06-30').
  const PREORDER_END = '2026-12-31';
  function preorderStatus(now = new Date()) {
    const day = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');
    if (day < PREORDER_START) return 'before';
    if (day > PREORDER_END) return 'after';
    return 'open';
  }
  function applyGate() {
    const s = preorderStatus();
    const gate = document.getElementById('preorderGate');
    const btn = document.getElementById('submitBtn');
    if (s === 'open') { gate.style.display = 'none'; btn.disabled = false; return; }
    btn.disabled = true;
    gate.style.display = '';
    gate.textContent = s === 'before'
      ? (currentLang === 'zh' ? `預售 ${PREORDER_START} 開始，敬請期待` : `Pre-order opens ${PREORDER_START}`)
      : (currentLang === 'zh' ? '預售已結束' : 'Pre-order has ended');
  }

  /* 渲染清單 */
  // 海的公因數 四款全包 $4320（原價 980+980+1680+1680 = 5320）
  const BUNDLES = [{
    id: 'sea-gcd-all4',
    productIds: ['sea-gcd-short-jelly', 'sea-gcd-short-tear',
                 'sea-gcd-long-jelly', 'sea-gcd-long-tear'],
    flatPrice: 4320,
  }];
  const listEl  = document.getElementById('cartList');
  const emptyEl = document.getElementById('cartEmpty');
  const areaEl  = document.getElementById('cartArea');
  const fmt = n => n.toLocaleString();

  function render() {
    const items = Cart.getItems();
    if (items.length === 0) {
      emptyEl.style.display = '';
      areaEl.style.display = 'none';
      applyLang(currentLang);
      return;
    }
    emptyEl.style.display = 'none';
    areaEl.style.display = '';
    listEl.innerHTML = items.map(it => `
      <div class="cart-row" data-id="${esc(it.id)}" data-size="${esc(it.size)}">
        ${it.img ? `<img class="cart-row-img" src="${esc(it.img)}" alt="">` : '<span class="cart-row-img"></span>'}
        <div class="cart-row-info">
          <span class="cart-row-name">${esc(it.name)}</span>
          <span class="cart-row-size">${currentLang === 'zh' ? '尺寸' : 'Size'}: ${esc(it.size)}</span>
          <span class="cart-row-price">NT$ ${it.price.toLocaleString()}</span>
        </div>
        <div class="cart-row-qty">
          <button type="button" class="qminus" aria-label="減少">−</button>
          <span class="qval">${it.qty}</span>
          <button type="button" class="qplus" aria-label="增加"
            ${it.maxQty && it.qty >= it.maxQty ? 'disabled' : ''}>+</button>
        </div>
        <button type="button" class="cart-row-del" aria-label="刪除">×</button>
      </div>`).join('');
    const p = computePricing(Cart.getItems(), { bundles: BUNDLES });
    document.getElementById('sumSubtotal').textContent = fmt(p.subtotal);
    document.getElementById('sumDiscount').textContent = fmt(p.discount);
    document.getElementById('sumDiscountRow').style.display = p.discount > 0 ? '' : 'none';
    document.getElementById('sumTotal').textContent = fmt(p.total);
    applyLang(currentLang);
  }

  /* 事件委派：加減 / 刪除 */
  listEl.addEventListener('click', e => {
    const row = e.target.closest('.cart-row');
    if (!row) return;
    const { id, size } = row.dataset;
    const cur = Cart.getItems().find(it => it.id === id && it.size === size);
    if (!cur) return;
    if (e.target.classList.contains('qminus')) Cart.updateQty(id, size, cur.qty - 1);
    else if (e.target.classList.contains('qplus')) {
      if (cur.maxQty && cur.qty >= cur.maxQty) return;
      Cart.updateQty(id, size, cur.qty + 1);
    }
    else if (e.target.classList.contains('cart-row-del')) Cart.remove(id, size);
    else return;
    render();
  });

  /* ---- 送出 ---- */
  async function submitOrder(payload, items) {
    // 登入狀態下用使用者 token（訂單掛帳號）；任何失敗都退回 anon key，絕不擋結帳
    let bearer = window.SUPABASE_ANON_KEY;
    if (sbClient) {
      try {
        const { data: { session } } = await sbClient.auth.getSession();
        if (session) bearer = session.access_token;
      } catch { /* 匿名結帳 */ }
    }
    const res = await fetch(`${window.SUPABASE_URL}/functions/v1/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${bearer}` },
      body: JSON.stringify({
        items: items.map(it => ({ id: it.id, size: it.size, qty: it.qty })),
        customer: { name: payload.name, social: payload.social, email: payload.email, notes: payload.notes },
        amount_type: 'full',
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'create-order failed');
    if (!data.action || !data.params) throw new Error('create-order response malformed');
    await saveProfile({ name: payload.name, social: payload.social, email: payload.email });
    const form = document.createElement('form');
    form.method = 'POST'; form.action = data.action;
    for (const [k, v] of Object.entries(data.params)) {
      const inp = document.createElement('input');
      inp.type = 'hidden'; inp.name = k; inp.value = String(v);
      form.appendChild(inp);
    }
    document.body.appendChild(form);
    Cart.clear();
    form.submit();
  }

  const form = document.getElementById('orderForm');
  const submitBtn = document.getElementById('submitBtn');
  const formError = document.getElementById('formError');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    formError.style.display = 'none';

    if (preorderStatus() !== 'open') return;
    const items = Cart.getItems();
    if (items.length === 0) return;
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const fd = new FormData(form);
    const payload = {
      name: fd.get('name').trim(),
      social: (fd.get('social') || '').trim(),
      email: fd.get('email').trim(),
      notes: (fd.get('notes') || '').trim(),
    };

    submitBtn.disabled = true;
    const orig = submitBtn.textContent;
    submitBtn.textContent = currentLang === 'zh' ? '前往付款…' : 'Redirecting…';
    try {
      await submitOrder(payload, items);   // 成功則頁面已跳轉 PAYUNi
    } catch (err) {
      formError.textContent = currentLang === 'zh' ? '建立訂單失敗，請改用 LINE 聯絡我們。' : 'Failed. Contact us via LINE.';
      formError.style.display = '';
      submitBtn.disabled = false;
      submitBtn.textContent = orig;
    }
  });

  applyLang(currentLang);
  render();
  applyGate();
});
