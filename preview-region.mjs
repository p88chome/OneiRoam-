// preview-region.mjs — editKey → 該區塊 HTML（草稿 settings → HTML），供 iframe 就地重渲染。
// 放 repo 根以便瀏覽器 import（見 preview-render.mjs 註解）。
import { announceHtml, eyebrowHtml, heroDescHtml, heroImgsHtml } from './preview-render.mjs';

const RENDERERS = {
  announce: announceHtml,
  hero_eyebrow: eyebrowHtml,
  hero_desc: heroDescHtml,
  hero_img: heroImgsHtml,
};

export const REGION_KEYS = ['announce', 'hero_eyebrow', 'hero_desc', 'hero_img'];

export function renderRegion(editKey, settings) {
  const fn = RENDERERS[editKey];
  return fn ? fn(settings || {}).trim() : null;
}
