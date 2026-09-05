// preview-harness.mjs — 全頁真預覽:抓真 index.html 的 <body> 注入本頁（看起來 100% 像正式站），
// 在真元素上標熱點 + 即時 patch，只渲染/回報點擊，不碰 DB。index.html 的 script 經 innerHTML
// 注入不會執行（純靜態預覽，避免其 JS 干擾）。
import { REGION_KEYS, REGION_SELECTORS, renderRegion } from './preview-region.mjs';

const PARENT_ORIGIN = location.origin; // admin 與預覽同源
let settings = {};

function patchRegion(key) {
  const el = document.querySelector(REGION_SELECTORS[key]);
  const html = renderRegion(key, settings);
  if (el && html != null) el.outerHTML = html; // render 輸出即同 class 完整元素，換掉即可
}
function paint() { REGION_KEYS.forEach(patchRegion); }

function applyLang(lang) {
  document.querySelectorAll('[data-zh]').forEach(el => {
    el.textContent = lang === 'en'
      ? (el.getAttribute('data-en') || el.getAttribute('data-zh'))
      : el.getAttribute('data-zh');
  });
}

function editKeyAt(target) {
  for (const key of REGION_KEYS) if (target.closest(REGION_SELECTORS[key])) return key;
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
    else if (m.type === 'patch') { settings = { ...settings, [m.key]: m.value }; paint(); }
    else if (m.type === 'theme') { document.documentElement.setAttribute('data-theme', m.value); }
    else if (m.type === 'lang') { applyLang(m.lang); }
  });

  // capture 階段攔截，先於（已失效的）站內 handler
  document.addEventListener('click', e => {
    const key = editKeyAt(e.target);
    if (!key) return;
    e.preventDefault();
    parent.postMessage({ source: 'oneiroam-preview', type: 'select', editKey: key }, PARENT_ORIGIN);
  }, true);

  parent.postMessage({ source: 'oneiroam-preview', type: 'ready' }, PARENT_ORIGIN);
}
boot();
