import test from 'node:test';
import assert from 'node:assert';
import { REGION_KEYS, REGION_SELECTORS, renderRegion } from '../preview-region.mjs';

test('preview-region: keys cover the editable hero regions (announce dropped)', () => {
  assert.deepStrictEqual(REGION_KEYS, ['hero_eyebrow', 'hero_desc', 'hero_img']);
});

test('preview-region: each key maps to its real index.html selector', () => {
  assert.deepStrictEqual(REGION_SELECTORS, {
    hero_eyebrow: '.hero-eyebrow',
    hero_desc: '.hero-desc',
    hero_img: '.hero-img',
  });
});

test('preview-region: renders each region from draft settings', () => {
  assert.match(renderRegion('hero_eyebrow', { hero_eyebrow_zh: '手作限量' }), /data-zh="手作限量"/);
  assert.match(renderRegion('hero_desc', { hero_desc_zh: '一句詩' }), /data-zh="一句詩"/);
  assert.match(renderRegion('hero_img', { hero_focus_1: '60' }), /object-position:center 60%/);
});

test('preview-region: render output element matches its selector class', () => {
  // outerHTML 換元素要靠 render 輸出帶同 class
  for (const key of REGION_KEYS) {
    const cls = REGION_SELECTORS[key].slice(1); // 去掉開頭的 "."
    assert.match(renderRegion(key, {}), new RegExp(`class="[^"]*\\b${cls}\\b`));
  }
});

test('preview-region: unknown / dropped key -> null', () => {
  assert.strictEqual(renderRegion('announce', {}), null);
  assert.strictEqual(renderRegion('nope', {}), null);
});
