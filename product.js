/* =============================================
   OneiRoaM — Product Detail Page (product-{id}.html)
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {
  const escHtml = s => String(s ?? '').replace(/[&<>"']/g, c =>
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
  function toggleLang() { applyLang(currentLang === 'zh' ? 'en' : 'zh'); }
  document.getElementById('langToggle').addEventListener('click', toggleLang);
  const mobileToggle = document.getElementById('langToggleMobile');
  if (mobileToggle) mobileToggle.addEventListener('click', toggleLang);
  applyLang(currentLang);
  updateCartBadge();

  /* ------------------------------------------
     ADD TO CART
     ------------------------------------------ */
  const grid = document.querySelector('.pd-grid');
  if (!grid) return;

  const sizeSel = document.getElementById('pdSize');
  const sizes = (grid.dataset.sizes || 'S,M,L,XL').split(',');
  function fillSizes() {
    const cur = sizeSel.value;
    sizeSel.innerHTML = sizes.map(s => `<option value="${escHtml(s)}">${escHtml(s)}</option>`).join('');
    if (sizes.includes(cur)) sizeSel.value = cur;
  }
  fillSizes();
  document.getElementById('langToggle').addEventListener('click', fillSizes);
  if (mobileToggle) mobileToggle.addEventListener('click', fillSizes);

  const qtyEl = document.getElementById('pdQty');
  document.getElementById('pdQtyMinus').addEventListener('click', () => {
    qtyEl.textContent = Math.max(1, parseInt(qtyEl.textContent, 10) - 1);
  });
  document.getElementById('pdQtyPlus').addEventListener('click', () => {
    qtyEl.textContent = parseInt(qtyEl.textContent, 10) + 1;
  });

  if (window.Gallery) Gallery.wire(document.querySelector('.pd-gallery'));

  document.getElementById('pdAdd').addEventListener('click', () => {
    const size = sizeSel.value;
    const img = grid.querySelector('.gallery-slide'); // 第一張＝封面
    const h1 = document.querySelector('h1');
    Cart.addItem({
      id: grid.dataset.id,
      name: currentLang === 'zh' ? h1.dataset.zh : h1.dataset.en,
      price: parseInt(grid.dataset.price, 10) || 0,
      size,
      qty: parseInt(qtyEl.textContent, 10),
      maxQty: parseInt(grid.dataset.maxQty, 10) || undefined,
      img: img ? img.getAttribute('src') : '',
    });
    updateCartBadge();
    document.getElementById('pdAdd').style.display = 'none';
    document.getElementById('pdAdded').classList.remove('js-hidden');
    document.getElementById('pdCheckout').classList.remove('js-hidden');
  });
});
