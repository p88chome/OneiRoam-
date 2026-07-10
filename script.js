/* =============================================
   OneiRoam — Main Script
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {

  /* ------------------------------------------
     LOADING SCREEN
     ------------------------------------------ */
  const loader = document.getElementById('loader');
  function hideLoader() {
    loader.classList.add('hidden');
    document.body.style.overflow = '';
  }
  document.body.style.overflow = 'hidden';
  // Hide after page load (min 1.2s for effect)
  const loaderTimer = setTimeout(hideLoader, 1400);
  window.addEventListener('load', () => {
    clearTimeout(loaderTimer);
    setTimeout(hideLoader, 600);
  });


  /* ------------------------------------------
     ANNOUNCEMENT BANNER
     ------------------------------------------ */
  const announceBar  = document.getElementById('announce-bar');
  const announceClose = document.getElementById('announceClose');
  const BANNER_KEY   = 'oneiRoamBannerClosed';

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
     LANGUAGE TOGGLE
     ------------------------------------------ */
  let currentLang = localStorage.getItem('oneiRoamLang') || 'zh';

  function applyLang(lang) {
    currentLang = lang;
    document.documentElement.lang = lang === 'zh' ? 'zh-TW' : 'en';
    document.body.setAttribute('data-lang', lang);

    document.querySelectorAll('[data-zh]').forEach(el => {
      const text = lang === 'zh' ? el.dataset.zh : el.dataset.en;
      if (text !== undefined) el.textContent = text;
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
     STICKY HEADER
     ------------------------------------------ */
  const header = document.getElementById('header');
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 50);
  }, { passive: true });


  /* ------------------------------------------
     HAMBURGER MENU
     ------------------------------------------ */
  const hamburger     = document.getElementById('hamburger');
  const mobileOverlay = document.getElementById('mobileOverlay');

  function openMenu()  {
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
     SMOOTH SCROLL
     ------------------------------------------ */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const href = anchor.getAttribute('href');
      if (!href || !href.startsWith('#') || href.length < 2) return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      const bannerH = announceBar.classList.contains('hidden') ? 0 : 32;
      const offset  = window.scrollY + target.getBoundingClientRect().top - 72 - bannerH;
      window.scrollTo({ top: offset, behavior: 'smooth' });
    });
  });


  /* ------------------------------------------
     COLLECTIONS FILTER
     ------------------------------------------ */
  const filterBtns  = document.querySelectorAll('.filter-btn');
  // 篩選只作用在原創設計區；選品區有自己的 grid，不參與篩選
  const productCards = document.querySelectorAll('#collections .product-card');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      productCards.forEach(card => {
        const match = filter === 'all' || card.dataset.category === filter;
        card.classList.toggle('hidden', !match);
        if (match) {
          card.style.animation = 'none';
          card.offsetHeight;
          card.style.animation = 'cardIn 0.45s var(--ease) both';
        }
      });
    });
  });

  // 導覽列分類連結：捲動到原創設計區並套用對應篩選
  document.querySelectorAll('[data-filter-link]').forEach(link => {
    link.addEventListener('click', () => {
      const btn = document.querySelector(`.filter-btn[data-filter="${link.dataset.filterLink}"]`);
      if (btn) btn.click();
    });
  });

  const styleEl = document.createElement('style');
  styleEl.textContent = `
    @keyframes cardIn {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(styleEl);


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
     PRODUCT MODAL
     ------------------------------------------ */
  const modal        = document.getElementById('productModal');
  const modalBackdrop = document.getElementById('modalBackdrop');
  const modalClose   = document.getElementById('modalClose');
  const modalImg     = document.getElementById('modalImg');
  const modalName    = document.getElementById('modalName');
  const modalDesc    = document.getElementById('modalDesc');
  const modalCat     = document.getElementById('modalCategory');

  function updateModalSubtotal() {
    const price = parseInt(modal.dataset.curPrice, 10) || 0;
    const qty = parseInt(document.getElementById('modalQty').textContent, 10) || 1;
    document.getElementById('modalSubtotal').textContent = (price * qty).toLocaleString();
  }

  function openModal(card) {
    const lang = currentLang;
    modalImg.style.display = card.dataset.modalImg ? '' : 'none'; // 沒圖就不留空白框
    modalImg.src    = card.dataset.modalImg || '';
    modalImg.alt    = lang === 'zh' ? card.dataset.modalNameZh : card.dataset.modalNameEn;
    modalName.textContent = lang === 'zh' ? card.dataset.modalNameZh : card.dataset.modalNameEn;
    modalDesc.textContent = lang === 'zh' ? card.dataset.modalDescZh : card.dataset.modalDescEn;
    modalCat.textContent  = lang === 'zh' ? card.dataset.modalCatZh  : card.dataset.modalCatEn;
    // 尺寸選項
    const sizeSel = document.getElementById('modalSize');
    const sizes = (card.dataset.sizes || 'S,M,L,XL').split(',');
    const customLabel = lang === 'zh' ? '自訂' : 'Custom';
    sizeSel.innerHTML = sizes.map(s => `<option value="${s}">${s}</option>`).join('')
      + `<option value="__custom">${customLabel}</option>`;
    document.getElementById('modalSizeCustom').style.display = 'none';
    document.getElementById('modalSizeCustom').value = '';
    document.getElementById('modalQty').textContent = '1';
    document.getElementById('modalAdded').style.display = 'none';
    document.getElementById('modalAdd').style.display = '';
    document.getElementById('modalCheckout').style.display = 'none';
    // 暫存目前商品供加入鈕使用
    modal.dataset.curId = card.dataset.id;
    modal.dataset.curMaxQty = card.dataset.maxQty || '';
    modal.dataset.curName = lang === 'zh' ? card.dataset.modalNameZh : card.dataset.modalNameEn;
    const priceText = card.querySelector('.product-price').textContent;
    modal.dataset.curPrice = priceText.replace(/[^0-9]/g, '');
    // 價格與小計
    document.getElementById('modalUnit').textContent = (parseInt(modal.dataset.curPrice, 10) || 0).toLocaleString();
    updateModalSubtotal();
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.open-modal').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      openModal(btn.closest('.product-card'));
    });
  });

  modalClose.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // 尺寸：選「自訂」顯示文字框
  document.getElementById('modalSize').addEventListener('change', e => {
    document.getElementById('modalSizeCustom').style.display =
      e.target.value === '__custom' ? '' : 'none';
  });
  // 數量加減
  const qtyEl = document.getElementById('modalQty');
  document.getElementById('modalQtyMinus').addEventListener('click', () => {
    qtyEl.textContent = Math.max(1, parseInt(qtyEl.textContent, 10) - 1);
    updateModalSubtotal();
  });
  document.getElementById('modalQtyPlus').addEventListener('click', () => {
    qtyEl.textContent = parseInt(qtyEl.textContent, 10) + 1;
    updateModalSubtotal();
  });
  // 加入訂單
  document.getElementById('modalAdd').addEventListener('click', () => {
    const sel = document.getElementById('modalSize');
    let size = sel.value;
    if (size === '__custom') {
      size = document.getElementById('modalSizeCustom').value.trim();
      if (!size) { document.getElementById('modalSizeCustom').focus(); return; }
    }
    Cart.addItem({
      id: modal.dataset.curId,
      name: modal.dataset.curName,
      price: parseInt(modal.dataset.curPrice, 10) || 0,
      size,
      qty: parseInt(qtyEl.textContent, 10),
      maxQty: parseInt(modal.dataset.curMaxQty, 10) || undefined,
    });
    updateCartBadge();
    document.getElementById('modalAdd').style.display = 'none';
    document.getElementById('modalAdded').style.display = '';
    document.getElementById('modalCheckout').style.display = '';
  });


  /* ------------------------------------------
     SCROLL ANIMATIONS
     ------------------------------------------ */
  const animateEls = document.querySelectorAll('.fade-up, .fade-left, .fade-right');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const delay = parseInt(entry.target.dataset.delay || '0', 10);
      setTimeout(() => entry.target.classList.add('visible'), delay);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  animateEls.forEach(el => observer.observe(el));

  /* ------------------------------------------
     IMAGE ERROR FALLBACK
     ------------------------------------------ */
  document.querySelectorAll('img').forEach(img => {
    const hide = () => { img.style.display = 'none'; };
    img.addEventListener('error', hide);
    if (img.complete && img.naturalWidth === 0) hide();
  });


  productCards.forEach((card, i) => {
    card.classList.add('fade-up');
    card.dataset.delay = String(i * 75);
    observer.observe(card);
  });
  document.querySelectorAll('#select .product-card').forEach((card, i) => {
    card.classList.add('fade-up');
    card.dataset.delay = String(i * 75);
    observer.observe(card);
  });
  document.querySelectorAll('.step').forEach((step, i) => {
    step.classList.add('fade-up');
    step.dataset.delay = String(i * 100);
    observer.observe(step);
  });
  document.querySelectorAll('.lookbook-item').forEach((item, i) => {
    item.classList.add('fade-up');
    item.dataset.delay = String(i * 60);
    observer.observe(item);
  });


  /* ------------------------------------------
     LOOKBOOK DRAG SCROLL
     ------------------------------------------ */
  const lookbook    = document.getElementById('lookbookScroll');
  if (lookbook) {
    let isDragging    = false;
    let dragStartX    = 0;
    let scrollStart   = 0;

    lookbook.addEventListener('mousedown', e => {
      isDragging = true; dragStartX = e.pageX - lookbook.offsetLeft;
      scrollStart = lookbook.scrollLeft; lookbook.classList.add('grabbing');
    });
    lookbook.addEventListener('mouseleave', () => { isDragging = false; lookbook.classList.remove('grabbing'); });
    lookbook.addEventListener('mouseup',    () => { isDragging = false; lookbook.classList.remove('grabbing'); });
    lookbook.addEventListener('mousemove', e => {
      if (!isDragging) return;
      e.preventDefault();
      lookbook.scrollLeft = scrollStart - (e.pageX - lookbook.offsetLeft - dragStartX) * 1.4;
    });
  }


  /* ------------------------------------------
     HERO IMAGE CROSSFADE
     ------------------------------------------ */
  const img1 = document.querySelector('.h-img-1');
  const img2 = document.querySelector('.h-img-2');
  if (img1 && img2) {
    let loaded = 0;
    const onLoad = () => {
      if (++loaded < 2) return;
      let showing = true;
      setInterval(() => {
        img1.style.opacity = showing ? '0' : '1';
        img2.style.opacity = showing ? '1' : '0';
        showing = !showing;
      }, 5000);
    };
    if (img1.complete) onLoad(); else img1.addEventListener('load', onLoad);
    if (img2.complete) onLoad(); else img2.addEventListener('load', onLoad);
  }

});
