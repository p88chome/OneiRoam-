import test from 'node:test';
import assert from 'node:assert';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mirrorPath, createMirror } from '../scripts/mirror-images.mjs';

const BASE = 'https://abc.supabase.co';
const U = p => `${BASE}/storage/v1/object/public/product-images/${p}`;

test('mirrorPath: 只收自己 bucket 的安全圖片路徑', () => {
  assert.strictEqual(mirrorPath(U('mono-123.jpg'), BASE), 'mono-123.jpg');
  assert.strictEqual(mirrorPath(U('site/hero_img_1-9.webp?x=1'), BASE), 'site/hero_img_1-9.webp');
  assert.strictEqual(mirrorPath('https://evil.com/a.jpg', BASE), null);
  assert.strictEqual(mirrorPath(U('../../etc/passwd.jpg'), BASE), null);
  assert.strictEqual(mirrorPath(U('a%2F..%2F..%2Fx.jpg'), BASE), null);
  assert.strictEqual(mirrorPath(U('page.html'), BASE), null);
  assert.strictEqual(mirrorPath('images/hero.jpg', BASE), null);
  assert.strictEqual(mirrorPath(undefined, BASE), null);
});

test('createMirror: 下載到 media/ 並回傳站內網址；同網址只下載一次', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mirror-'));
  let calls = 0;
  const fetchImpl = async () => { calls++; return new Response(new Uint8Array([1, 2, 3])); };
  const m = createMirror({ base: BASE, outDir: dir, fetchImpl, log: { warn() {} } });
  const map = await m.mirrorAll([U('a.jpg'), U('a.jpg'), U('site/b.png'), 'images/hero.jpg']);
  assert.strictEqual(map.get(U('a.jpg')), '/media/a.jpg');
  assert.strictEqual(map.get(U('site/b.png')), '/media/site/b.png');
  assert.strictEqual(map.get('images/hero.jpg'), 'images/hero.jpg');
  assert.strictEqual(calls, 2);
  assert.deepStrictEqual([...await readFile(join(dir, 'a.jpg'))], [1, 2, 3]);
  assert.strictEqual(m.stats.mirrored, 2);
  await rm(dir, { recursive: true });
});

test('createMirror: 下載失敗（重試後）保留原網址', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mirror-'));
  let calls = 0;
  const fetchImpl = async () => { calls++; return new Response('no', { status: 503 }); };
  const m = createMirror({ base: BASE, outDir: dir, fetchImpl, log: { warn() {} } });
  assert.strictEqual(await m.mirror(U('a.jpg')), U('a.jpg'));
  assert.strictEqual(calls, 3);
  assert.strictEqual(m.stats.failed, 1);
  await rm(dir, { recursive: true });
});
