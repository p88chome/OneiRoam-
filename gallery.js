/* =============================================
   OneiRoaM — 商品多圖：大圖（scroll-snap，可左右滑）＋縮圖列
   結構（product-pages.mjs 會 SSR 同樣的 markup）：
   <div class="gallery">
     <div class="gallery-track pd-img-wrap|modal-img-wrap"><img class="gallery-slide">…</div>
     <div class="gallery-thumbs"><button class="gallery-thumb is-active" data-i="0"><img></button>…</div>
   </div>
   全部用 DOM API 建元素，不走 innerHTML。
   ============================================= */
(function (global) {
  function track(g) { return g.querySelector('.gallery-track'); }
  function thumbs(g) { return g.querySelector('.gallery-thumbs'); }

  function setActive(g, i) {
    thumbs(g).querySelectorAll('.gallery-thumb').forEach((b, j) => {
      b.classList.toggle('is-active', j === i);
      b.setAttribute('aria-current', j === i ? 'true' : 'false');
    });
  }

  // 綁一次即可（事件委派），之後 set() 換圖不用重綁
  function wire(g) {
    if (!g || g.dataset.wired) return;
    g.dataset.wired = '1';
    const t = track(g);
    thumbs(g).addEventListener('click', e => {
      const b = e.target.closest('.gallery-thumb');
      if (!b) return;
      const i = parseInt(b.dataset.i, 10) || 0;
      t.scrollTo({ left: i * t.clientWidth, behavior: 'smooth' });
      setActive(g, i);
    });
    let raf = 0;
    t.addEventListener('scroll', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (t.clientWidth) setActive(g, Math.round(t.scrollLeft / t.clientWidth));
      });
    }, { passive: true });
  }

  // 換一組圖（首頁彈窗用）
  function set(g, urls, alt) {
    // 只收 https 或站內相對路徑，擋 javascript:/data: 等奇怪 scheme
    const list = (urls || []).filter(u => typeof u === 'string' && /^(https:\/\/|\/(?!\/)|images\/)/.test(u));
    const t = track(g), th = thumbs(g);
    t.replaceChildren(...list.map((u, i) => {
      const img = document.createElement('img');
      img.className = 'gallery-slide';
      img.src = u;
      img.alt = alt || '';
      if (i > 0) img.loading = 'lazy';
      return img;
    }));
    th.replaceChildren(...(list.length > 1 ? list : []).map((u, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'gallery-thumb' + (i === 0 ? ' is-active' : '');
      b.dataset.i = String(i);
      b.setAttribute('aria-label', `第 ${i + 1} 張`);
      const img = document.createElement('img');
      img.src = u;
      img.alt = '';
      img.loading = 'lazy';
      b.appendChild(img);
      return b;
    }));
    th.classList.toggle('js-hidden', list.length < 2);
    t.scrollLeft = 0;
    wire(g);
  }

  global.Gallery = { wire, set };
})(window);
