import test from 'node:test';
import assert from 'node:assert';
import {
  THEMES, heroImgsHtml, announceHtml, eyebrowHtml, heroDescHtml, applyTheme,
} from '../scripts/site-settings.mjs';

test('THEMES: 四組預設配色', () => {
  assert.deepStrictEqual(THEMES, ['default', 'sage', 'latte', 'mist']);
});

test('heroImgsHtml: 預設圖與焦點', () => {
  const html = heroImgsHtml({});
  assert.match(html, /src="images\/hero-1\.jpg"[^>]*h-img-1/);
  assert.match(html, /src="images\/hero-2\.jpg"[^>]*h-img-2/);
  assert.match(html, /object-position:center 22%/);
  assert.match(html, /object-position:center 32%/);
  assert.match(html, /h-img-2[^>]*loading="lazy"/);
});

test('heroImgsHtml: 自訂圖與焦點、跳脫網址', () => {
  const html = heroImgsHtml({
    hero_img_1: 'https://x.supabase.co/a"b.jpg', hero_focus_1: '40',
  });
  assert.match(html, /src="https:\/\/x\.supabase\.co\/a&quot;b\.jpg"/);
  assert.match(html, /object-position:center 40%/);
});

test('heroImgsHtml: 焦點非數字/超界 → 25', () => {
  const html = heroImgsHtml({ hero_focus_1: 'abc', hero_focus_2: '150' });
  const m = html.match(/object-position:center (\d+)%/g);
  assert.deepStrictEqual(m, ['object-position:center 25%', 'object-position:center 25%']);
});

test('announceHtml: 自訂文字、en 空白 fallback zh', () => {
  const html = announceHtml({ announce_zh: '春季預購中', announce_en: '' });
  assert.match(html, /data-zh="春季預購中"/);
  assert.match(html, /data-en="春季預購中"/);
  assert.match(html, />春季預購中</);
  assert.match(html, /class="announce-text"/);
});

test('announceHtml: 沒設定 → 現行預設文案', () => {
  const html = announceHtml({});
  assert.match(html, /現正接受預購/);
  assert.match(html, /Pre-order Now/);
});

test('eyebrowHtml/heroDescHtml: 預設與自訂', () => {
  assert.match(eyebrowHtml({}), /獨立設計 · 手作限量/);
  assert.match(heroDescHtml({ hero_desc_zh: '新的一句詩' }), /data-zh="新的一句詩"/);
  assert.match(eyebrowHtml({}), /class="hero-eyebrow"/);
  assert.match(heroDescHtml({}), /class="hero-desc"/);
});

test('applyTheme: 替換 data-theme；未知值 → default', () => {
  const page = '<html lang="zh-TW" data-theme="default"><body></body></html>';
  assert.match(applyTheme(page, 'sage'), /data-theme="sage"/);
  assert.match(applyTheme(page, 'hacker'), /data-theme="default"/);
  assert.strictEqual(applyTheme('<html lang="x"><b></b></html>', 'sage'),
    '<html lang="x"><b></b></html>'); // 沒有 data-theme 屬性 → 原樣
});
