// scripts/product-pages.mjs
// 商品獨立頁（SEO/分享直連）：/product-{id}.html。沿用 select.html 的殼，內容改單一商品
// 完整資訊＋直接加入購物車（不經彈窗）。發布時由 build-products.mjs 逐商品產生。
import { esc, priceBlock } from './render-products.mjs';

const AVAIL = { sold_out: 'OutOfStock', active: 'InStock', preorder: 'PreOrder' };

// 多圖：大圖 scroll-snap 軌道＋縮圖列（結構需與 gallery.js 的 set() 一致）
export function galleryHtml(p) {
  const imgs = (p.images && p.images.length ? p.images : (p.image ? [p.image] : [])).filter(Boolean);
  const slides = imgs.map((u, i) =>
    `<img src="${esc(u)}" alt="${esc(p.name_zh)}" class="gallery-slide"${i ? ' loading="lazy"' : ''}>`).join('');
  const thumbs = imgs.length > 1
    ? imgs.map((u, i) =>
        `<button type="button" class="gallery-thumb${i ? '' : ' is-active'}" data-i="${i}" aria-label="第 ${i + 1} 張" aria-current="${i ? 'false' : 'true'}"><img src="${esc(u)}" alt="" loading="lazy"></button>`).join('')
    : '';
  return `<div class="gallery pd-gallery">
          <div class="gallery-track pd-img-wrap">${slides}</div>
          <div class="gallery-thumbs${imgs.length > 1 ? '' : ' js-hidden'}">${thumbs}</div>
        </div>`;
}

export function renderProductPage(p) {
  const canonical = `https://www.oneiroam.com/product-${p.id}.html`;
  const image = p.image
    ? (p.image.startsWith('http') ? p.image : `https://www.oneiroam.com${p.image}`)
    : 'https://www.oneiroam.com/favicon.svg';
  const desc = p.desc_zh || p.name_zh;
  const abs = u => (u.startsWith('http') ? u : `https://www.oneiroam.com${u}`);
  const allImages = (p.images && p.images.length ? p.images : (p.image ? [p.image] : [])).map(abs);

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name_zh,
    ...(p.name_en ? { alternateName: p.name_en } : {}),
    ...(p.desc_zh ? { description: p.desc_zh } : {}),
    image: allImages.length > 1 ? allImages : image,
    brand: { '@type': 'Brand', name: 'OneiRoaM' },
    offers: {
      '@type': 'Offer', priceCurrency: 'TWD', price: String(p.price),
      availability: `https://schema.org/${AVAIL[p.status] || 'PreOrder'}`, url: canonical,
    },
  };
  const jsonldTag = `<script type="application/ld+json">\n${
    JSON.stringify(jsonld, null, 2).replace(/</g, '\\u003c')
  }\n  </script>`;

  return `<!DOCTYPE html>
<html lang="zh-TW" data-theme="default">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${esc(desc)}">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://ywzsjhaqgidgxnjmyyeg.supabase.co; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'">
  <title>${esc(p.name_zh)} — OneiRoaM 夢游</title>
  <link rel="canonical" href="${canonical}">
  <meta name="robots" content="index, follow">
  <link rel="icon" type="image/svg+xml" href="favicon.svg">
  <meta property="og:type" content="product">
  <meta property="og:title" content="${esc(p.name_zh)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:site_name" content="OneiRoaM">
  <meta property="og:locale" content="zh_TW">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(p.name_zh)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image" content="${esc(image)}">
  ${jsonldTag}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Noto+Sans+TC:wght@300;400;500&family=Noto+Serif+TC:ital,wght@0,300;1,300&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
</head>
<body data-lang="zh">

  <!-- ===== LOADING SCREEN ===== -->
  <div id="loader">
    <div class="loader-inner">
      <span class="loader-brand">OneiRoaM</span>
      <span class="loader-sub" data-zh="夢游" data-en="Wander Through Dreams">夢游</span>
      <div class="loader-line"></div>
    </div>
  </div>

  <!-- ===== HEADER ===== -->
  <header id="header">
    <div class="header-inner">
      <button class="hamburger" id="hamburger" aria-label="選單">
        <span></span><span></span><span></span>
      </button>
      <a href="index.html" class="logo">
        <span class="logo-brand">OneiRoaM</span>
        <span class="logo-sub" data-zh="夢游" data-en="Wander Through Dreams">夢游</span>
      </a>
      <nav id="main-nav">
        <a href="index.html#hero" data-zh="首頁" data-en="Home">首頁</a>
        <div class="nav-drop">
          <a href="index.html#collections" data-zh="獨立設計" data-en="Independent Design">獨立設計</a>
          <div class="drop-menu">
            <a href="index.html#collections" data-zh="澎袖" data-en="Puff Sleeves">澎袖</a>
            <a href="index.html#collections" data-zh="領片" data-en="Collars">領片</a>
            <a href="index.html#collections" data-zh="套裝" data-en="Sets">套裝</a>
            <a href="index.html#collections" data-zh="上衣" data-en="Tops">上衣</a>
            <a href="index.html#collections" data-zh="下著" data-en="Bottoms">下著</a>
            <a href="index.html#collections" data-zh="其他配件" data-en="Accessories">其他配件</a>
          </div>
        </div>
        <a href="select.html" data-zh="選品" data-en="Select Goods">選品</a>
        <a href="index.html#order" data-zh="購物須知" data-en="Shopping Guide">購物須知</a>
        <a href="index.html#about" data-zh="關於夢游" data-en="About OneiRoaM">關於夢游</a>
      </nav>
      <button class="lang-toggle" id="langToggle" aria-label="語言切換">
        <span class="l-zh active">中</span>
        <span class="l-div">|</span>
        <span class="l-en">EN</span>
      </button>
      <a href="member.html" class="member-link" aria-label="會員專區">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="22" height="22">
          <circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>
        </svg>
      </a>
      <a href="order.html" class="cart-link" aria-label="訂單" id="cartLink">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="22" height="22">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
          <path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>
        </svg>
        <span class="cart-badge" id="cartBadge" data-hide>0</span>
      </a>
    </div>
  </header>

  <!-- Mobile Overlay Nav -->
  <div class="mobile-overlay" id="mobileOverlay">
    <nav class="mobile-nav">
      <a href="index.html#hero" data-zh="首頁" data-en="Home">首頁</a>
      <a href="index.html#collections" data-zh="獨立設計" data-en="Independent Design">獨立設計</a>
      <div class="mobile-subnav">
        <a href="index.html#collections" data-zh="澎袖" data-en="Puff Sleeves">澎袖</a>
        <a href="index.html#collections" data-zh="領片" data-en="Collars">領片</a>
        <a href="index.html#collections" data-zh="套裝" data-en="Sets">套裝</a>
        <a href="index.html#collections" data-zh="上衣" data-en="Tops">上衣</a>
        <a href="index.html#collections" data-zh="下著" data-en="Bottoms">下著</a>
        <a href="index.html#collections" data-zh="其他配件" data-en="Accessories">其他配件</a>
      </div>
      <a href="select.html" data-zh="選品" data-en="Select Goods">選品</a>
      <a href="index.html#order" data-zh="購物須知" data-en="Shopping Guide">購物須知</a>
      <a href="index.html#about" data-zh="關於夢游" data-en="About OneiRoaM">關於夢游</a>
      <a href="member.html" data-zh="會員專區" data-en="My Account">會員專區</a>
    </nav>
    <div class="mobile-overlay-lang">
      <button class="lang-toggle-mobile" id="langToggleMobile">
        <span class="l-zh active">中</span>
        <span class="l-div">|</span>
        <span class="l-en">EN</span>
      </button>
    </div>
  </div>

  <!-- ===== PRODUCT DETAIL ===== -->
  <main class="product-page">
    <div class="container">
      <nav class="breadcrumb">
        <a href="index.html" data-zh="首頁" data-en="Home">首頁</a> ／
        <a href="index.html#collections" data-zh="獨立設計" data-en="Independent Design">獨立設計</a> ／
        <span data-zh="${esc(p.name_zh)}" data-en="${esc(p.name_en)}">${esc(p.name_zh)}</span>
      </nav>
      <div class="pd-grid" data-id="${esc(p.id)}" data-sizes="${esc(p.sizes.join(','))}" data-max-qty="${esc(p.max_qty)}" data-price="${esc(p.price)}" data-full-price="${esc(p.full_price > p.price ? p.full_price : '')}">
        ${galleryHtml(p)}
        <div class="pd-info">
          <p class="section-label" data-zh="${esc(p.cat_zh)}" data-en="${esc(p.cat_en)}">${esc(p.cat_zh)}</p>
          <h1 data-zh="${esc(p.name_zh)}" data-en="${esc(p.name_en)}">${esc(p.name_zh)}</h1>
          <p class="pd-desc" data-zh="${esc(p.desc_zh)}" data-en="${esc(p.desc_en)}">${esc(p.desc_zh)}</p>
          ${priceBlock(p, 'pd')}
          <div class="modal-order">
            <label class="modal-size-label" data-zh="尺寸" data-en="Size">尺寸</label>
            <select id="pdSize" class="modal-size-select"></select>
            <div class="modal-qty">
              <button type="button" id="pdQtyMinus" aria-label="減少">−</button>
              <span id="pdQty">1</span>
              <button type="button" id="pdQtyPlus" aria-label="增加">+</button>
            </div>
            <button id="pdAdd" class="btn-primary"
                    data-zh="加入購物車" data-en="Add to Cart">加入購物車</button>
            <span id="pdAdded" class="modal-added js-hidden"
                  data-zh="已加入 ✓" data-en="Added ✓">已加入 ✓</span>
          </div>
          <a href="order.html" id="pdCheckout" class="btn-primary modal-checkout js-hidden"
             data-zh="前往結帳 →" data-en="Go to Checkout →">前往結帳 →</a>
          <p class="modal-note" data-zh="✦ 限時預訂，售完即止" data-en="✦ Limited-time pre-order, while stocks last">✦ 限時預訂，售完即止</p>
        </div>
      </div>
    </div>
  </main>

  <!-- ===== FOOTER ===== -->
  <footer id="footer">
    <div class="footer-inner">
      <div class="footer-brand">
        <span class="footer-logo-en">OneiRoaM</span>
        <span class="footer-logo-zh" data-zh="夢游" data-en="Wander Through Dreams">夢游</span>
      </div>
      <nav class="footer-nav">
        <a href="index.html#collections" data-zh="獨立設計" data-en="Independent Design">獨立設計</a>
        <a href="select.html" data-zh="選品" data-en="Select Goods">選品</a>
        <a href="index.html#order" data-zh="購物須知" data-en="Shopping Guide">購物須知</a>
        <a href="index.html#about" data-zh="關於夢游" data-en="About OneiRoaM">關於夢游</a>
      </nav>
      <div class="footer-social">
        <a href="https://www.instagram.com/oneiroam?igsh=MW5rZGF3Z3BpNms2eQ==" aria-label="Instagram" target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20">
            <rect x="2" y="2" width="20" height="20" rx="5"/>
            <circle cx="12" cy="12" r="4"/>
            <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" stroke="none"/>
          </svg>
        </a>
        <a href="https://line.me/R/ti/p/@547hgbaz" aria-label="LINE" target="_blank" rel="noopener noreferrer">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 .999C5.926.999 1 5.4 1 10.827c0 4.73 4.195 8.687 9.866 9.44.384.083.907.253 1.04.581.119.298.078.764.038 1.065l-.168.994c-.051.297-.237 1.163 1.028.634 1.264-.528 6.817-4 9.297-6.855C23.22 14.851 24 12.928 24 10.827 24 5.4 18.075.999 12 .999zm-4.667 13.5H5.167a.833.833 0 0 1-.834-.833V9.499a.833.833 0 1 1 1.667 0v3.334h1.333a.833.833 0 1 1 0 1.666zm2.5-.833a.833.833 0 1 1-1.666 0V9.499a.833.833 0 1 1 1.666 0v4.167zm5.167 0a.833.833 0 0 1-.815-.658l-1.685-3.342v3.167a.833.833 0 1 1-1.667 0V9.499a.833.833 0 0 1 1.648-.174l1.685 3.342V9.499a.833.833 0 1 1 1.667 0v4.167a.833.833 0 0 1-.833.833zm3.667 0h-2.5a.833.833 0 0 1-.834-.833V9.499a.833.833 0 1 1 1.667 0v3.334h1.667a.833.833 0 1 1 0 1.666z"/></svg>
        </a>
      </div>
      <p class="footer-copy" data-zh="© 2026 OneiRoaM. 保留所有權利。" data-en="© 2026 OneiRoaM. All rights reserved.">© 2026 OneiRoaM. 保留所有權利。</p>
      <p class="footer-legal"><a href="privacy.html" data-zh="隱私權政策" data-en="Privacy Policy">隱私權政策</a></p>
    </div>
  </footer>

  <script src="cart.js"></script>
  <script src="gallery.js"></script>
  <script src="product.js"></script>
</body>
</html>
`;
}
