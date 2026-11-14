document.addEventListener('DOMContentLoaded', () => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
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

  /* 預售日期閘門 — 無截止日，永久開放下單（僅保留開始日前的擋） */
  const PREORDER_START = '2026-06-23';
  function preorderStatus(now = new Date()) {
    const day = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');
    if (day < PREORDER_START) return 'before';
    return 'open';
  }
  function applyGate() {
    const s = preorderStatus();
    const gate = document.getElementById('preorderGate');
    const btn = document.getElementById('submitBtn');
    if (s === 'open') { gate.style.display = 'none'; btn.disabled = false; return; }
    btn.disabled = true;
    gate.style.display = '';
    gate.textContent = currentLang === 'zh' ? `預售 ${PREORDER_START} 開始，敬請期待` : `Pre-order opens ${PREORDER_START}`;
  }

  /* 渲染清單 */
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
          <span class="cart-row-price">${it.fullPrice
            ? `<span class="cart-row-line">${currentLang === 'zh' ? '全額' : 'Full'} NT$ ${esc(it.fullPrice.toLocaleString())}</span><span class="cart-row-line">${currentLang === 'zh' ? '訂金' : 'Deposit'} NT$ ${esc(it.price.toLocaleString())}</span>`
            : `NT$ ${esc(it.price.toLocaleString())}`}</span>
        </div>
        <div class="cart-row-qty">
          <button type="button" class="qminus" aria-label="減少">−</button>
          <span class="qval">${it.qty}</span>
          <button type="button" class="qplus" aria-label="增加"
            ${it.maxQty && it.qty >= it.maxQty ? 'disabled' : ''}>+</button>
        </div>
        <button type="button" class="cart-row-del" aria-label="刪除">×</button>
      </div>`).join('');
    const p = computePricing(Cart.getItems(), { discountThreshold: Infinity });
    document.getElementById('sumDiscount').textContent = fmt(p.discount);
    document.getElementById('sumDiscountRow').style.display = p.discount > 0 ? '' : 'none';
    document.getElementById('sumTotal').textContent = fmt(p.total);
    // 預購：全部品項都有全額 → 標「本次應付訂金」；尾款＝(全額−訂金)×數量，貨到付款（僅顯示用）
    const allDeposit = items.length > 0 && items.every(it => it.fullPrice);
    const label = document.getElementById('sumTotalLabel');
    label.dataset.zh = allDeposit ? '本次應付訂金' : '本次應付';
    label.dataset.en = allDeposit ? 'Deposit due now' : 'Due now';
    const balance = items.reduce((n, it) => n + (it.fullPrice ? (it.fullPrice - it.price) * it.qty : 0), 0);
    document.getElementById('sumBalance').textContent = fmt(balance);
    document.getElementById('sumBalanceRow').classList.toggle('js-hidden', balance <= 0);
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

  /* ---- 購物車校正：用資料庫現況檢查（下架、尺寸改了、售完、數量超過、價格變動） ---- */
  const noticeEl = document.getElementById('cartNotice');
  const NOTE_TEXT = {
    not_available: (n) => currentLang === 'zh' ? `「${n.name}」已下架或暫停販售，已從購物車移除。` : `"${n.name}" is no longer available and was removed.`,
    size_missing: (n) => currentLang === 'zh' ? `「${n.name}」的尺寸「${n.size}」已不提供，已從購物車移除，請回商品頁重新選擇尺寸。` : `Size "${n.size}" of "${n.name}" is no longer offered and was removed — please choose a size again.`,
    sold_out: (n) => currentLang === 'zh' ? `「${n.name}」（${n.size}）已售完，已從購物車移除。` : `"${n.name}" (${n.size}) is sold out and was removed.`,
    qty_reduced: (n) => currentLang === 'zh' ? `「${n.name}」數量已依庫存／限購調整為 ${n.value}。` : `Quantity of "${n.name}" was reduced to ${n.value} (stock / purchase limit).`,
    price_changed: (n) => currentLang === 'zh' ? `「${n.name}」價格已更新為 NT$ ${Number(n.value).toLocaleString()}。` : `Price of "${n.name}" was updated to NT$ ${Number(n.value).toLocaleString()}.`,
  };
  function showNotes(notes) {
    if (!noticeEl) return;
    if (!notes.length) { noticeEl.style.display = 'none'; noticeEl.textContent = ''; return; }
    noticeEl.textContent = '';
    for (const n of notes) {
      const p = document.createElement('p');
      p.textContent = (NOTE_TEXT[n.reason] || (() => ''))(n);
      noticeEl.appendChild(p);
    }
    noticeEl.style.display = '';
  }
  // 回傳是否有變動；查詢失敗就略過（伺服器仍會把關）
  async function validateCart() {
    const items = Cart.getItems();
    if (!sbClient || !items.length || !window.reconcileCart) return false;
    try {
      const ids = [...new Set(items.map(it => it.id))];
      const [{ data: products, error: pErr }, { data: variants, error: vErr }] = await Promise.all([
        sbClient.from('products').select('id,status,price,full_price').in('id', ids),
        sbClient.from('product_variants').select('product_id,size,stock,max_qty').in('product_id', ids),
      ]);
      if (pErr || vErr) return false;
      const { items: fixed, notes } = window.reconcileCart(items, products, variants);
      showNotes(notes);
      if (!notes.length) return false;
      Cart.replace(fixed);
      render();
      return true;
    } catch {
      return false;
    }
  }

  /* ---- 人機驗證（Cloudflare Turnstile）：有設 site key 才載入 ---- */
  const turnstile = { id: null, token: '' };
  if (window.TURNSTILE_SITE_KEY) {
    window.onTurnstileLoad = () => {
      turnstile.id = window.turnstile.render('#turnstileBox', {
        sitekey: window.TURNSTILE_SITE_KEY,
        action: 'checkout',
        language: currentLang === 'zh' ? 'zh-tw' : 'en',
        callback: t => { turnstile.token = t; },
        'expired-callback': () => { turnstile.token = ''; },
        'error-callback': () => { turnstile.token = ''; },
      });
    };
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad';
    s.async = true;
    document.head.appendChild(s);
  }
  function resetTurnstile() {
    // token 只能用一次：送出失敗後要重新驗證
    turnstile.token = '';
    if (turnstile.id != null && window.turnstile) window.turnstile.reset(turnstile.id);
  }

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
        discount_code: payload.discountCode || undefined,
        turnstileToken: turnstile.token || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      const err = new Error(data.error || 'create-order failed');
      err.code = data.code;
      throw err;
    }
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
    if (window.TURNSTILE_SITE_KEY && !turnstile.token) {
      formError.textContent = currentLang === 'zh' ? '請完成人機驗證' : 'Please complete the verification';
      formError.style.display = '';
      return;
    }

    const fd = new FormData(form);
    const payload = {
      name: fd.get('name').trim(),
      social: (fd.get('social') || '').trim(),
      email: fd.get('email').trim(),
      notes: (fd.get('notes') || '').trim(),
      discountCode: (fd.get('discount_code') || '').trim(),
    };

    submitBtn.disabled = true;
    const orig = submitBtn.textContent;
    submitBtn.textContent = currentLang === 'zh' ? '前往付款…' : 'Redirecting…';
    try {
      await submitOrder(payload, items);   // 成功則頁面已跳轉 PAYUNi
    } catch (err) {
      // 依伺服器回傳的 code 顯示具體原因；購物車類問題先自動校正購物車
      const zh = currentLang === 'zh';
      const CART_CODES = ['not_available', 'size_missing', 'out_of_stock', 'over_limit'];
      const MSG = {
        discount_invalid: ['折扣碼無效', 'Invalid discount code'],
        discount_expired: ['折扣碼已過期', 'Discount code has expired'],
        discount_used_up: ['折扣碼已達使用上限', 'Discount code has reached its limit'],
        turnstile_missing: ['請完成人機驗證', 'Please complete the verification'],
        turnstile_failed: ['人機驗證失敗，請重新整理再試一次', 'Verification failed — please reload and try again'],
        bad_email: ['Email 格式不正確', 'Invalid email address'],
        empty_cart: ['購物車是空的', 'Your cart is empty'],
      };
      if (CART_CODES.includes(err.code)) {
        await validateCart();
        formError.textContent = zh ? '購物車已依最新庫存更新，請確認上方內容後再送出。' : 'Your cart was updated to match current stock — please review and submit again.';
      } else if (MSG[err.code]) {
        formError.textContent = MSG[err.code][zh ? 0 : 1];
      } else {
        formError.textContent = zh ? '建立訂單失敗，請稍後再試，或改用 LINE 聯絡我們。' : 'Failed to create the order. Please try again later or contact us via LINE.';
      }
      formError.style.display = '';
      resetTurnstile();
      submitBtn.disabled = false;
      submitBtn.textContent = orig;
    }
  });

  applyLang(currentLang);
  render();
  applyGate();
  validateCart();
});
