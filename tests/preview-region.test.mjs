import test from 'node:test';
import assert from 'node:assert';
import { REGION_KEYS, renderRegion } from '../preview-region.mjs';

test('preview-region: keys cover the four home regions', () => {
  assert.deepStrictEqual(REGION_KEYS, ['announce', 'hero_eyebrow', 'hero_desc', 'hero_img']);
});

test('preview-region: renders each region from draft settings', () => {
  assert.match(renderRegion('announce', { announce_zh: '春季預購' }), /data-zh="春季預購"/);
  assert.match(renderRegion('hero_eyebrow', { hero_eyebrow_zh: '手作限量' }), /data-zh="手作限量"/);
  assert.match(renderRegion('hero_desc', { hero_desc_zh: '一句詩' }), /data-zh="一句詩"/);
  assert.match(renderRegion('hero_img', { hero_focus_1: '60' }), /object-position:center 60%/);
});

test('preview-region: unknown key -> null', () => {
  assert.strictEqual(renderRegion('nope', {}), null);
});
