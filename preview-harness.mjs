// preview-harness.mjs — 全頁真預覽:抓真 index.html 的 <body> 注入本頁，在真元素上標熱點 + 即時 patch。
// hero 區塊(P1.5) + 商品卡文字(P2)。只渲染/回報點擊，不碰 DB。注入的 script 不執行。
import { REGION_KEYS, REGION_SELECTORS, renderRegion } from './preview-region.mjs';
import { FIELD_SELECTORS, parseKey, priceText } from './preview-product.mjs';

const PARENT_ORIGIN = location.origin; // admin 與預覽同源
let settings = {};
let lang = 'zh';

function patchRegion(key) {
  const el = document.querySelector(REGION_SELECTORS[key]);
  const html = renderRegion(key, settings);
  if (el && html != null) el.outerHTML = html;
}
function paint() { REGION_KEYS.forEach(patchRegion); }

function applyLang(l) {
  lang = l;
  document.querySelectorAll('[data-zh]').forEach(el => {
    el.textContent = l === 'en'
      ? (el.getAttribute('data-en') || el.getAttribute('data-zh'))
      : el.getAttribute('data-zh');
  });
}

function cardOf(id) {
  return document.querySelector(`.product-card[data-id="${CSS.escape(id)}"]`);
}

function patchProduct(productId, key, value) {
  const card = cardOf(productId);
  if (!card) return;
  if (key === 'price') {
    const el = card.querySelector(FIELD_SELECTORS.price);
    if (el) el.textContent = priceText(value);
    return;
  }
  const p = parseKey(key);
  if (!p) return;
  let el = card.querySelector(FIELD_SELECTORS[p.field]);
  if (p.field === 'badge' && !el) {
    // 徽章原本為空 → 補一個到 .product-img-wrap（比照 renderProductCards 結構）
    const wrap = card.querySelector('.product-img-wrap');
    if (!wrap) return;
    el = document.createElement('span');
    el.className = 'product-badge';
    el.setAttribute('data-zh', '');
    el.setAttribute('data-en', '');
    wrap.appendChild(el);
  }
  if (!el) return;
  el.setAttribute('data-' + p.lang, value);
  if (p.lang === lang) el.textContent = value;
  if (p.field === 'badge' && !el.getAttribute('data-zh') && !el.getAttribute('data-en')) el.remove();
}

function siteRegionAt(target) {
  for (const key of REGION_KEYS) if (target.closest(REGION_SELECTORS[key])) return key;
  return null;
}
function productFieldAt(target) {
  const card = target.closest('.product-card');
  if (!card || !card.dataset.id) return null;
  for (const field of Object.keys(FIELD_SELECTORS)) {
    const el = target.closest(FIELD_SELECTORS[field]);
    if (el && card.contains(el)) return { productId: card.dataset.id, field };
  }
  return null;
}

async function boot() {
  try {
    const html = await fetch('index.html', { cache: 'no-store' }).then(r => r.text());
    const doc = new DOMParser().parseFromString(html, 'text/html');
    document.body.innerHTML = doc.body.innerHTML;
    document.body.classList.add('ve-preview-body');
  } catch (e) {
    document.body.innerHTML = '<p style="padding:2rem">預覽載入失敗：' + (e && e.message || e) + '</p>';
  }

  window.addEventListener('message', e => {
    if (e.origin !== PARENT_ORIGIN) return;
    const m = e.data || {};
    if (m.source !== 'oneiroam-editor') return;
    if (m.type === 'render') { settings = m.settings || {}; paint(); }
    else if (m.type === 'patch') {
      if (m.scope === 'product') patchProduct(m.productId, m.key, m.value);
      else { settings = { ...settings, [m.key]: m.value }; paint(); }
    }
    else if (m.type === 'theme') document.documentElement.setAttribute('data-theme', m.value);
    else if (m.type === 'lang') applyLang(m.lang);
  });

  // capture 階段攔截，先於（已失效的）站內 handler
  document.addEventListener('click', e => {
    const prod = productFieldAt(e.target);
    if (prod) {
      e.preventDefault();
      parent.postMessage({ source: 'oneiroam-preview', type: 'select', scope: 'product', productId: prod.productId, field: prod.field }, PARENT_ORIGIN);
      return;
    }
    const region = siteRegionAt(e.target);
    if (region) {
      e.preventDefault();
      parent.postMessage({ source: 'oneiroam-preview', type: 'select', scope: 'site', editKey: region }, PARENT_ORIGIN);
    }
  }, true);

  parent.postMessage({ source: 'oneiroam-preview', type: 'ready' }, PARENT_ORIGIN);
}
boot();
