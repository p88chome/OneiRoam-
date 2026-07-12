/* =============================================
   OneiRoam — Member Zone (member.html)
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ------------------------------------------
     LOADING SCREEN
     ------------------------------------------ */
  const loader = document.getElementById('loader');
  function hideLoader() {
    loader.classList.add('hidden');
    document.body.style.overflow = '';
  }
  document.body.style.overflow = 'hidden';
  const loaderTimer = setTimeout(hideLoader, 1400);
  window.addEventListener('load', () => {
    clearTimeout(loaderTimer);
    setTimeout(hideLoader, 600);
  });

  /* ------------------------------------------
     ANNOUNCEMENT BANNER
     ------------------------------------------ */
  const announceBar = document.getElementById('announce-bar');
  const announceClose = document.getElementById('announceClose');
  const BANNER_KEY = 'oneiRoamBannerClosed';
  if (sessionStorage.getItem(BANNER_KEY)) {
    announceBar.classList.add('hidden');
  } else {
    document.body.classList.add('has-banner');
  }
  announceClose.addEventListener('click', () => {
    announceBar.classList.add('hidden');
    document.body.classList.remove('has-banner');
    sessionStorage.setItem(BANNER_KEY, '1');
  });

  /* ------------------------------------------
     STICKY HEADER
     ------------------------------------------ */
  const header = document.getElementById('header');
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 50);
  }, { passive: true });

  /* ------------------------------------------
     HAMBURGER MENU
     ------------------------------------------ */
  const hamburger = document.getElementById('hamburger');
  const mobileOverlay = document.getElementById('mobileOverlay');
  function openMenu() {
    mobileOverlay.classList.add('open');
    hamburger.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeMenu() {
    mobileOverlay.classList.remove('open');
    hamburger.classList.remove('open');
    document.body.style.overflow = '';
  }
  hamburger.addEventListener('click', () => {
    mobileOverlay.classList.contains('open') ? closeMenu() : openMenu();
  });
  mobileOverlay.querySelectorAll('.mobile-nav a').forEach(l => l.addEventListener('click', closeMenu));

  /* ------------------------------------------
     CART BADGE
     ------------------------------------------ */
  function updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    if (!badge) return;
    const n = Cart.count();
    badge.textContent = n;
    badge.style.display = n > 0 ? '' : 'none';
  }

  /* ------------------------------------------
     LANGUAGE TOGGLE
     ------------------------------------------ */
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
  function toggleLang() {
    applyLang(currentLang === 'zh' ? 'en' : 'zh');
    renderOrders();
    const profileMsgEl = document.getElementById('profileMsg');
    if (profileMsgEl) profileMsgEl.textContent = '';
  }
  document.getElementById('langToggle').addEventListener('click', toggleLang);
  const mobileToggle = document.getElementById('langToggleMobile');
  if (mobileToggle) mobileToggle.addEventListener('click', toggleLang);

  /* ------------------------------------------
     MEMBER: Google 登入 → 訂單／個人資料
     ------------------------------------------ */
  const sbClient = (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY)
    ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY,
        { auth: { flowType: 'pkce' } })
    : null;

  const STATUS = {
    pending: { cls: 's-pending', zh: '待付款', en: 'Pending' },
    paid:    { cls: 's-paid',    zh: '已付款', en: 'Paid' },
    failed:  { cls: 's-failed',  zh: '付款失敗', en: 'Failed' },
  };
  let orders = [];

  function renderOrders() {
    const el = document.getElementById('orderList');
    if (!el) return;
    if (!orders.length) {
      el.innerHTML = `<p class="member-empty">${currentLang === 'zh' ? '還沒有訂單——去逛逛吧 ✦' : 'No orders yet — go browse ✦'}</p>`;
      return;
    }
    el.innerHTML = orders.map(o => {
      const st = STATUS[o.payment_status] || STATUS.pending;
      const items = (o.order_items || []).map(i =>
        `<li>${esc(i.name)}（${esc(i.size)}）× ${esc(i.qty)} — NT$ ${Number(i.price * i.qty).toLocaleString()}</li>`).join('');
      return `
      <div class="order-card">
        <div class="order-card-head">
          <span class="order-card-no">${esc(o.order_no)}</span>
          <span class="order-status ${st.cls}">${currentLang === 'zh' ? st.zh : st.en}</span>
        </div>
        <p class="order-card-date">${esc((o.created_at || '').slice(0, 10))}</p>
        <ul class="order-card-items">${items}</ul>
        <p class="order-card-sum">${currentLang === 'zh' ? '合計' : 'Total'} NT$ ${Number(o.total).toLocaleString()}
          · ${o.amount_type === 'deposit' ? (currentLang === 'zh' ? '訂金' : 'Deposit') : (currentLang === 'zh' ? '全額' : 'Full')} NT$ ${Number(o.pay_amount).toLocaleString()}</p>
      </div>`;
    }).join('');
  }

  async function loadMember() {
    const login = document.getElementById('memberLogin');
    const area = document.getElementById('memberArea');
    if (!sbClient) { login.style.display = ''; return; }
    const { data: { session } } = await sbClient.auth.getSession();
    if (!session) {
      login.style.display = ''; area.style.display = 'none';
      orders = [];
      const orderListEl = document.getElementById('orderList');
      if (orderListEl) orderListEl.innerHTML = '';
      document.getElementById('profileForm').reset();
      return;
    }
    login.style.display = 'none'; area.style.display = '';
    document.getElementById('mEmail').textContent = session.user.email || '';
    const [{ data: os }, { data: profile }] = await Promise.all([
      sbClient.from('orders')
        .select('order_no, created_at, payment_status, amount_type, total, pay_amount, order_items(name, size, qty, price)')
        // RLS 已限制，只是把「只看自己的」寫明（admin 帳號開這頁也不會看到全店訂單）
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false }),
      sbClient.from('customer_profiles').select('*')
        .eq('user_id', session.user.id).maybeSingle(),
    ]);
    orders = os || [];
    renderOrders();
    const form = document.getElementById('profileForm');
    for (const k of ['name', 'phone', 'social', 'email'])
      form.elements[k].value = (profile && profile[k]) || (k === 'email' ? session.user.email || '' : '');
  }

  if (sbClient) {
    const loginBtn = document.getElementById('googleLoginBtn');
    const logoutBtn = document.getElementById('mLogout');
    if (loginBtn) loginBtn.addEventListener('click', () => {
      sbClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/member.html' },
      });
    });
    if (logoutBtn) logoutBtn.addEventListener('click', async () => {
      await sbClient.auth.signOut();
      loadMember();
    });
  }

  const profileForm = document.getElementById('profileForm');
  const profileMsg = document.getElementById('profileMsg');
  if (profileForm) profileForm.addEventListener('submit', async e => {
    e.preventDefault();
    profileMsg.textContent = '';
    if (!sbClient) return;
    const fd = new FormData(profileForm);
    const fields = {
      name: (fd.get('name') || '').trim(),
      phone: (fd.get('phone') || '').trim(),
      social: (fd.get('social') || '').trim(),
      email: (fd.get('email') || '').trim(),
    };
    try {
      const { data: { session } } = await sbClient.auth.getSession();
      if (!session) throw new Error('not signed in');
      const { error } = await sbClient.from('customer_profiles').upsert({
        user_id: session.user.id,
        name: fields.name, phone: fields.phone,
        social: fields.social, email: fields.email,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      profileMsg.textContent = currentLang === 'zh' ? '✓ 已儲存' : '✓ Saved';
    } catch (err) {
      profileMsg.textContent = currentLang === 'zh' ? '儲存失敗' : 'Save failed';
    }
  });

  applyLang(currentLang);
  updateCartBadge();
  loadMember();
  // bfcache（返回鍵還原頁面）不會重跑 script — 重新驗證登入狀態
  window.addEventListener('pageshow', e => { if (e.persisted) loadMember(); });
});
