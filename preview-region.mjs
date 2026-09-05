// preview-region.mjs — editKey → 該區塊 HTML（草稿 settings → HTML）＋ 對應真頁面選擇器，
// 供全頁預覽 harness 就地換掉真 index.html 的對應元素。放 repo 根以便瀏覽器 import。
import { eyebrowHtml, heroDescHtml, heroImgsHtml } from './preview-render.mjs';

const RENDERERS = {
  hero_eyebrow: eyebrowHtml,
  hero_desc: heroDescHtml,
  hero_img: heroImgsHtml,
};

// 真 index.html 上的對應元素（render 輸出即同 class 的完整元素，可直接 outerHTML 換掉）。
// 註：公告列已於 commit 2426957 從網站移除，故不列為可編輯區塊。
export const REGION_SELECTORS = {
  hero_eyebrow: '.hero-eyebrow',
  hero_desc: '.hero-desc',
  hero_img: '.hero-img',
};

export const REGION_KEYS = ['hero_eyebrow', 'hero_desc', 'hero_img'];

export function renderRegion(editKey, settings) {
  const fn = RENDERERS[editKey];
  return fn ? fn(settings || {}).trim() : null;
}
