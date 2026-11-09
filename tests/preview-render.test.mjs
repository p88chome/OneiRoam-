import test from 'node:test';
import assert from 'node:assert';
import {
  THEMES, esc, heroImgsHtml, announceHtml, eyebrowHtml, heroDescHtml, applyTheme,
} from '../preview-render.mjs';

test('preview-render: esc escapes html-sensitive chars', () => {
  assert.strictEqual(esc(`<a"'&>`), '&lt;a&quot;&#39;&amp;&gt;');
});

test('preview-render: THEMES matches four presets', () => {
  assert.deepStrictEqual(THEMES, ['default', 'sage', 'latte', 'mist']);
});

test('preview-render: hero/announce/eyebrow/desc render defaults', () => {
  assert.match(heroImgsHtml({}), /object-position:center 35%/);
  assert.match(announceHtml({}), /現正接受預購/);
  assert.match(eyebrowHtml({}), /class="hero-eyebrow"/);
  assert.match(heroDescHtml({}), /class="hero-desc"/);
});

test('preview-render: applyTheme swaps data-theme, unknown -> default', () => {
  const page = '<html lang="zh-TW" data-theme="default"></html>';
  assert.match(applyTheme(page, 'sage'), /data-theme="sage"/);
  assert.match(applyTheme(page, 'nope'), /data-theme="default"/);
});
