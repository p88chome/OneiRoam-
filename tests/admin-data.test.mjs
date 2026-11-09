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
