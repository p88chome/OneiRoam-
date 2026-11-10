import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { applyTexts, extractTexts, parseTexts } from '../scripts/site-texts.mjs';

const P = '<p data-zh="原本" data-en="Orig">原本</p>';

test('applyTexts: 換中英文與內文，記住原 key', () => {
  const out = applyTexts(P, { 原本: { zh: '新的', en: 'New' } });
  assert.strictEqual(out, '<p data-zh="新的" data-en="New" data-tk="原本">新的</p>');
});

test('applyTexts: 英文留白沿用原英文', () => {
  const out = applyTexts(P, { 原本: { zh: '新的', en: '  ' } });
  assert.match(out, /data-en="Orig"/);
});

test('applyTexts: 重跑用 data-tk 對 key，不重複加 data-tk', () => {
  const once = applyTexts(P, { 原本: { zh: '新的', en: 'New' } });
  const twice = applyTexts(once, { 原本: { zh: '再改', en: 'Again' } });
  assert.strictEqual(twice, '<p data-zh="再改" data-en="Again" data-tk="原本">再改</p>');
});

test('applyTexts: 跳脫 HTML，不能塞標籤', () => {
  const out = applyTexts(P, { 原本: { zh: '<img src=x onerror=alert(1)>"', en: 'a&b' } });
  assert.ok(!out.includes('<img'));
  assert.match(out, /data-zh="&lt;img src=x onerror=alert\(1\)&gt;&quot;"/);
  assert.match(out, /data-en="a&amp;b"/);
});

test('applyTexts: BUILD 區塊內不動', () => {
  const html = `<!-- BUILD:PRODUCTS:START -->${P}<!-- BUILD:PRODUCTS:END -->${P}`;
  const out = applyTexts(html, { 原本: { zh: '新的', en: 'New' } });
  assert.ok(out.startsWith(`<!-- BUILD:PRODUCTS:START -->${P}<!-- BUILD:PRODUCTS:END -->`));
  assert.ok(out.endsWith('>新的</p>'));
});

test('applyTexts: 內文不是那句（有子元素）時只換屬性', () => {
  const html = '<a data-zh="選單" data-en="Menu"><span>x</span></a>';
  const out = applyTexts(html, { 選單: { zh: '目錄', en: '' } });
  assert.strictEqual(out, '<a data-zh="目錄" data-en="Menu" data-tk="選單"><span>x</span></a>');
});

test('applyTexts: 屬性裡的 &quot; 會先解碼成 key', () => {
  const html = '<p data-zh="按「加入」&amp;送出" data-en="x">按「加入」&amp;送出</p>';
  const out = applyTexts(html, { '按「加入」&送出': { zh: '改了', en: '' } });
  assert.match(out, />改了<\/p>$/);
});

test('parseTexts: 壞 JSON 回空物件', () => {
  assert.deepStrictEqual(parseTexts('nope'), {});
  assert.deepStrictEqual(parseTexts('[1]'), {});
  assert.deepStrictEqual(parseTexts(''), {});
});

test('extractTexts: 分組、去重、跳過 BUILD 區塊', () => {
  const index = `<header id="header"><a data-zh="首頁" data-en="Home">首頁</a></header>
<section id="about"><p data-zh="關於" data-en="About">關於</p></section>
<!-- BUILD:PRODUCTS:START --><p data-zh="商品名" data-en="P">商品名</p><!-- BUILD:PRODUCTS:END -->
<footer id="footer"><p data-zh="版權" data-en="C">版權</p></footer>`;
  const order = `<header id="header"><a data-zh="首頁" data-en="Home">首頁</a></header>
<form id="orderForm"><label data-zh="暱稱" data-en="Name">暱稱</label></form>`;
  const list = extractTexts([['index.html', index], ['order.html', order]]);
  assert.deepStrictEqual(list.map(t => [t.key, t.group]), [
    ['首頁', '頁首／選單'], ['關於', '關於夢游'], ['版權', '頁尾'], ['暱稱', '結帳頁'],
  ]);
});

test('extractTexts: 真實頁面每句都有分組', () => {
  const pages = ['index.html', 'select.html', 'order.html', 'member.html']
    .map(f => [f, readFileSync(f, 'utf8')]);
  const list = extractTexts(pages);
  assert.ok(list.length > 50);
  assert.ok(list.every(t => t.group && !t.group.endsWith('.html')));
  assert.ok(list.some(t => t.group === '購物須知與下單流程'));
  assert.ok(list.some(t => t.group === '關於夢游'));
});

test('applyTexts: 繼承屬性不當成覆寫', () => {
  const html = '<p data-zh="constructor" data-en="c">constructor</p>';
  assert.strictEqual(applyTexts(html, { x: { zh: 'y' } }), html);
});
