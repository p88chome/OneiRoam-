import test from 'node:test';
import assert from 'node:assert';
import { injectBlock } from '../scripts/inject-block.mjs';

const page = `<div>
        <!-- BUILD:FOO:START -->
        old stuff
        <!-- BUILD:FOO:END -->
</div>`;

test('injectBlock: 取代 marker 之間內容', () => {
  const out = injectBlock(page, 'FOO', '        new stuff');
  assert.match(out, /BUILD:FOO:START -->\n        new stuff\n        <!-- BUILD:FOO:END/);
  assert.doesNotMatch(out, /old stuff/);
});

test('injectBlock: marker 不存在 → 原樣返回（warn）', () => {
  const out = injectBlock('<div>no markers</div>', 'FOO', 'x');
  assert.strictEqual(out, '<div>no markers</div>');
});

test('injectBlock: required 且 marker 不存在 → throw', () => {
  assert.throws(() => injectBlock('<div></div>', 'FOO', 'x', { required: true }),
    /BUILD:FOO markers not found/);
});

test('injectBlock: endIndent 客製', () => {
  const out = injectBlock(page, 'FOO', 'x', { endIndent: '  ' });
  assert.match(out, /\nx\n  <!-- BUILD:FOO:END/);
});

test('injectBlock: 內容含 $& 等替換樣式須原樣輸出', () => {
  const out = injectBlock(page, 'FOO', "價格 $&#39; 與 $$ 與 $& 原樣");
  assert.match(out, /價格 \$&#39; 與 \$\$ 與 \$& 原樣/);
  assert.strictEqual((out.match(/BUILD:FOO:START/g) || []).length, 1);
});
