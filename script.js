/* =============================================
   OneiRoam — Main Script
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {

  /* ------------------------------------------
     LANGUAGE TOGGLE
     ------------------------------------------ */
  let currentLang = localStorage.getItem('oneiRoamLang') || 'zh';

  function applyLang(lang) {
    currentLang = lang;
    document.documentElement.lang = lang === 'zh' ? 'zh-TW' : 'en';
    document.body.setAttribute('data-lang', lang);

    // Update all translatable elements
    document.querySelectorAll('[data-zh]').forEach(el => {
      const text = lang === 'zh' ? el.dataset.zh : el.dataset.en;
      if (text !== undefined) el.textContent = text;
    });

    // Sync both toggles (header + mobile)
    document.querySelectorAll('.l-zh').forEach(el => el.classList.toggle('active', lang === 'zh'));
    document.querySelectorAll('.l-en').forEach(el => el.classList.toggle('active', lang === 'en'));

    localStorage.setItem('oneiRoamLang', lang);
  }

  function toggleLang() {
    applyLang(currentLang === 'zh' ? 'en' : 'zh');
  }

  document.getElementById('langToggle').addEventListener('click', toggleLang);
  const mobileToggle = document.getElementById('langToggleMobile');
  if (mobileToggle) mobileToggle.addEventListener('click', toggleLang);

  // Init
  applyLang(currentLang);


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

  mobileOverlay.querySelectorAll('.mobile-nav a').forEach(link => {
    link.addEventListener('click', closeMenu);
  });


  /* ------------------------------------------
     SMOOTH SCROLL (offset for fixed header)
     ------------------------------------------ */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const offset = window.scrollY + target.getBoundingClientRect().top - 72;
      window.scrollTo({ top: offset, behavior: 'smooth' });
    });
  });


  /* ------------------------------------------
     COLLECTIONS FILTER
     ------------------------------------------ */
  const filterBtns = document.querySelectorAll('.filter-btn');
  const productCards = document.querySelectorAll('.product-card');

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
          card.offsetHeight; // reflow
          card.style.animation = 'cardIn 0.45s var(--ease) both';
        }
      });
    });
  });

  // Inject keyframe dynamically (avoids CSS global pollution)
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    @keyframes cardIn {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(styleEl);


  /* ------------------------------------------
     SCROLL ANIMATIONS (Intersection Observer)
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

  // Stagger product cards
  productCards.forEach((card, i) => {
    card.classList.add('fade-up');
    card.dataset.delay = String(i * 75);
    observer.observe(card);
  });

  // Stagger steps
  document.querySelectorAll('.step').forEach((step, i) => {
    step.classList.add('fade-up');
    step.dataset.delay = String(i * 100);
    observer.observe(step);
  });

  // Stagger lookbook items
  document.querySelectorAll('.lookbook-item').forEach((item, i) => {
    item.classList.add('fade-up');
    item.dataset.delay = String(i * 60);
    observer.observe(item);
  });


  /* ------------------------------------------
     LOOKBOOK DRAG SCROLL
     ------------------------------------------ */
  const lookbook = document.getElementById('lookbookScroll');
  let isDragging = false;
  let dragStartX = 0;
  let scrollStartLeft = 0;

  lookbook.addEventListener('mousedown', e => {
    isDragging = true;
    dragStartX = e.pageX - lookbook.offsetLeft;
    scrollStartLeft = lookbook.scrollLeft;
    lookbook.classList.add('grabbing');
  });
  lookbook.addEventListener('mouseleave', () => {
    isDragging = false;
    lookbook.classList.remove('grabbing');
  });
  lookbook.addEventListener('mouseup', () => {
    isDragging = false;
    lookbook.classList.remove('grabbing');
  });
  lookbook.addEventListener('mousemove', e => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - lookbook.offsetLeft;
    lookbook.scrollLeft = scrollStartLeft - (x - dragStartX) * 1.4;
  });


  /* ------------------------------------------
     HERO IMAGE CROSSFADE
     ------------------------------------------ */
  const img1 = document.querySelector('.h-img-1');
  const img2 = document.querySelector('.h-img-2');

  if (img1 && img2) {
    // Only start crossfade after both images have loaded
    let loadedCount = 0;
    const onLoad = () => {
      loadedCount++;
      if (loadedCount < 2) return;
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
