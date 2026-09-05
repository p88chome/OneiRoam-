// preview-harness.mjs — 預覽 iframe 內的渲染器：只渲染 + 回報點擊，不碰 DB。
import { REGION_KEYS, renderRegion } from './preview-region.mjs';

const PARENT_ORIGIN = location.origin; // admin 與預覽同源
let settings = {};

function paint() {
  for (const key of REGION_KEYS) {
    const el = document.querySelector(`[data-edit="${key}"]`);
    if (el) el.innerHTML = renderRegion(key, settings) || '';
  }
}

function applyLang(lang) {
  document.querySelectorAll('[data-zh]').forEach(el => {
    const t = lang === 'en' ? (el.getAttribute('data-en') || el.getAttribute('data-zh')) : el.getAttribute('data-zh');
    el.textContent = t;
  });
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

document.addEventListener('click', e => {
  const el = e.target.closest('[data-edit]');
  if (!el) return;
  e.preventDefault();
  parent.postMessage({ source: 'oneiroam-preview', type: 'select', editKey: el.dataset.edit }, PARENT_ORIGIN);
});

parent.postMessage({ source: 'oneiroam-preview', type: 'ready' }, PARENT_ORIGIN);
