import test from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';

// Load admin-data.js into a fake window with a stubbed sb, then exercise the API.
async function loadAdminData(sb) {
  const code = await readFile(new URL('../admin-data.js', import.meta.url), 'utf8');
  const window = { sb };
  new Function('window', code)(window);
  return window.adminData;
}

test('admin-data.saveSettings upserts rows', async () => {
  let got = null;
  const sb = { from: () => ({ upsert: rows => { got = rows; return Promise.resolve({ error: null }); } }) };
  const adminData = await loadAdminData(sb);
  await adminData.saveSettings([{ key: 'theme', value: 'sage' }]);
  assert.deepStrictEqual(got, [{ key: 'theme', value: 'sage' }]);
});

test('admin-data.saveSettings throws on error', async () => {
  const sb = { from: () => ({ upsert: () => Promise.resolve({ error: new Error('rls') }) }) };
  const adminData = await loadAdminData(sb);
  await assert.rejects(() => adminData.saveSettings([]), /rls/);
});

test('admin-data.uploadImage returns public url', async () => {
  const sb = { storage: { from: () => ({
    upload: () => Promise.resolve({ error: null }),
    getPublicUrl: () => ({ data: { publicUrl: 'https://cdn/x.jpg' } }),
  }) } };
  const adminData = await loadAdminData(sb);
  const file = { name: 'a.jpg', type: 'image/jpeg' };
  assert.strictEqual(await adminData.uploadImage(file, 'hero_img_1'), 'https://cdn/x.jpg');
});

test('admin-data.saveProduct updates products by id', async () => {
  let got = null;
  const sb = { from: t => ({ update: fields => ({ eq: (col, val) => {
    got = { t, fields, col, val }; return Promise.resolve({ error: null });
  } }) }) };
  const adminData = await loadAdminData(sb);
  await adminData.saveProduct('bag-x', { price: 100, name_zh: 'x' });
  assert.deepStrictEqual(got, { t: 'products', fields: { price: 100, name_zh: 'x' }, col: 'id', val: 'bag-x' });
});

test('admin-data.saveProduct throws on error', async () => {
  const sb = { from: () => ({ update: () => ({ eq: () => Promise.resolve({ error: new Error('rls') }) }) }) };
  const adminData = await loadAdminData(sb);
  await assert.rejects(() => adminData.saveProduct('x', {}), /rls/);
});

test('admin-data.fitSize: 縮到寬 2000 / 高 2800 內、等比例、不放大', async () => {
  const adminData = await loadAdminData({});
  assert.deepStrictEqual(adminData.fitSize(4284, 5712), { w: 2000, h: 2667 });
  assert.deepStrictEqual(adminData.fitSize(1000, 4000), { w: 700, h: 2800 });
  assert.deepStrictEqual(adminData.fitSize(800, 600), { w: 800, h: 600 });
});

test('admin-data.compressImage: 環境不支援時回原檔；非圖片拒絕', async () => {
  const adminData = await loadAdminData({});
  const file = { name: 'a.png', type: 'image/png', size: 10 };
  const r = await adminData.compressImage(file);
  assert.strictEqual(r.blob, file);
  assert.strictEqual(r.ext, 'png');
  await assert.rejects(() => adminData.compressImage({ type: 'image/svg+xml' }), /只接受/);
});
