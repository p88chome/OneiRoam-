// preview-render.mjs — 純渲染函式，建置(Node)與後台視覺預覽(瀏覽器)共用。
// 必須放 repo 根：scripts/ 在 .assetsignore 內，不會被 CDN 服務，瀏覽器 import 會 404。
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const THEMES = ['default', 'sage', 'latte', 'mist'];

const DEFAULTS = {
  hero_img_1: 'images/hero.jpg',
  hero_focus_1: '35',
  announce_zh: '✦ 現正接受預購 · 限時預訂 · 私訊 LINE 詢問 ✦',
  announce_en: '✦ Pre-order Now · Limited-time · Message us on LINE ✦',
  hero_eyebrow_zh: '獨立設計 · 限時預訂',
  hero_eyebrow_en: 'Independent Design · Limited-time Pre-order',
  hero_desc_zh: '以夢為靈感，每一件都是穿在身上的詩',
  hero_desc_en: 'Inspired by dreams — every piece is poetry you wear',
};

const pick = (s, k) => (s[k] && String(s[k]).trim()) || DEFAULTS[k];
const focus = v => { const n = parseInt(v, 10); return n >= 0 && n <= 100 ? n : 25; };

export function heroImgsHtml(s) {
  const src = pick(s, 'hero_img_1');
  const f = focus(pick(s, 'hero_focus_1'));
  return `      <img src="${esc(src)}" alt="OneiRoam" class="hero-img h-img-1" width="1178" height="1178" style="object-position:center ${f}%">`;
}

function pair(s, base) {
  const zh = pick(s, `${base}_zh`);
  const en = (s[`${base}_en`] && String(s[`${base}_en`]).trim()) || (s[`${base}_zh`] ? zh : DEFAULTS[`${base}_en`]);
  return { zh, en };
}

export function bilingualText(cls, zh, en, tag = 'p') {
  return `<${tag} class="${cls}" data-zh="${esc(zh)}" data-en="${esc(en)}">${esc(zh)}</${tag}>`;
}

export function announceHtml(s) {
  const { zh, en } = pair(s, 'announce');
  return `      ${bilingualText('announce-text', zh, en, 'span')}`;
}
export function eyebrowHtml(s) {
  const { zh, en } = pair(s, 'hero_eyebrow');
  return `      ${bilingualText('hero-eyebrow', zh, en)}`;
}
export function heroDescHtml(s) {
  const { zh, en } = pair(s, 'hero_desc');
  return `      ${bilingualText('hero-desc', zh, en)}`;
}

export function applyTheme(html, theme) {
  const t = THEMES.includes(theme) ? theme : 'default';
  return html.replace(/(<html[^>]*\bdata-theme=")[^"]*(")/, `$1${t}$2`);
}
