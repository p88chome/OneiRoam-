// admin-data.js — 後台寫入/上傳共用函式（舊表單 + 視覺編輯共用）。window.sb 由 admin.js 建立，呼叫時才取。
// 只收點陣圖：副檔名由 MIME 決定（不信任檔名），擋 SVG/HTML 這類可執行內容進公開 bucket
const IMAGE_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
window.adminData = {
  imageExt(file) {
    const ext = IMAGE_EXT[file && file.type];
    if (!ext) throw new Error('只接受 JPG / PNG / WebP / AVIF 圖片');
    return ext;
  },
  async uploadImage(file, key) {
    const ext = window.adminData.imageExt(file);
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
