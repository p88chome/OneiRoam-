// 老闆後台「網站設定」→ 發布時注入的 HTML。純函式，settings = {key: value}。
// admin.js 的 THEME_OPTIONS 需與 THEMES 同步（瀏覽器端無法 import 此檔）。
import { esc } from './render-products.mjs';

export const THEMES = ['default', 'sage', 'latte', 'mist'];

const DEFAULTS = {
  hero_img_1: 'images/hero-1.jpg',
  hero_img_2: 'images/hero-2.jpg',
  hero_focus_1: '22',
  hero_focus_2: '32',
  announce_zh: '✦ 現正接受預購 · 限量手作 · 私訊 LINE 詢問 ✦',
  announce_en: '✦ Pre-order Now · Limited Handcraft · Message us on LINE ✦',
  hero_eyebrow_zh: '獨立設計 · 手作限量',
  hero_eyebrow_en: 'Independent Design · Limited Handcraft',
  hero_desc_zh: '以夢為靈感，每一件都是穿在身上的詩',
  hero_desc_en: 'Inspired by dreams — every piece is poetry you wear',
};

const pick = (s, k) => (s[k] && String(s[k]).trim()) || DEFAULTS[k];
const focus = v => { const n = parseInt(v, 10); return n >= 0 && n <= 100 ? n : 25; };

export function heroImgsHtml(s) {
  const imgs = [
    { src: pick(s, 'hero_img_1'), cls: 'h-img-1', f: focus(pick(s, 'hero_focus_1')), lazy: false },
    { src: pick(s, 'hero_img_2'), cls: 'h-img-2', f: focus(pick(s, 'hero_focus_2')), lazy: true },
  ];
  // 手機版直式 banner（選填）：≤640px 蓋在桌機圖上（CSS .h-img-m 控制）
  const mob = s.hero_img_m && String(s.hero_img_m).trim();
  if (mob) imgs.push({ src: mob, cls: 'h-img-m', f: focus(s.hero_focus_m ?? '50'), lazy: false });
  return imgs.map(i =>
    `      <img src="${esc(i.src)}" alt="OneiRoam" class="hero-img ${i.cls}" style="object-position:center ${i.f}%"${i.lazy ? ' loading="lazy"' : ''}>`
  ).join('\n');
}

// zh 有值而 en 空 → en fallback zh（EN 模式不能出現空字）
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
