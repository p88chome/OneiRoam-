// admin-data.js — 後台寫入/上傳共用函式（舊表單 + 視覺編輯共用）。window.sb 由 admin.js 建立，呼叫時才取。
window.adminData = {
  async uploadImage(file, key) {
    const ext = (file.name.includes('.') ? file.name.split('.').pop() : '') || (file.type.split('/')[1] || 'jpg');
    const path = `site/${key}-${Date.now()}.${ext}`;
    const up = await window.sb.storage.from('product-images').upload(path, file, { upsert: true });
    if (up.error) throw up.error;
    const { data: pub } = window.sb.storage.from('product-images').getPublicUrl(path);
    return pub.publicUrl;
  },
  async saveSettings(rows) {
    const { error } = await window.sb.from('settings').upsert(rows);
    if (error) throw error;
  },
  async saveProduct(id, fields) {
    const { error } = await window.sb.from('products').update(fields).eq('id', id);
    if (error) throw error;
  },
};
