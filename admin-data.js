// admin-data.js — 後台寫入/上傳共用函式（舊表單 + 視覺編輯共用）。window.sb 由 admin.js 建立，呼叫時才取。
// 只收點陣圖：副檔名由 MIME 決定（不信任檔名），擋 SVG/HTML 這類可執行內容進公開 bucket
const IMAGE_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };

// 上傳前壓縮：手機原圖動輒 4000px / 4MB，網站上 2000px 寬已足夠（手機螢幕最多約 1170px）。
// 寬 ≤ 2000、高 ≤ 2800，WebP 品質 0.85；瀏覽器不支援 WebP 編碼（舊 Safari）改 JPEG。
const MAX_W = 2000;
const MAX_H = 2800;
const QUALITY = 0.85;

function fitSize(w, h, maxW = MAX_W, maxH = MAX_H) {
  const s = Math.min(1, maxW / w, maxH / h);
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

const toBlob = (canvas, type, q) => new Promise(res => canvas.toBlob(res, type, q));

window.adminData = {
  fitSize,
  imageExt(file) {
    const ext = IMAGE_EXT[file && file.type];
    if (!ext) throw new Error('只接受 JPG / PNG / WebP / AVIF 圖片');
    return ext;
  },
  // 回傳 { blob, ext, type }。壓縮失敗、環境不支援、或壓完反而更大 → 用原檔
  async compressImage(file) {
    const ext = window.adminData.imageExt(file);
    const original = { blob: file, ext, type: file.type };
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return original;
    try {
      // imageOrientation：依 EXIF 轉正（手機直拍照片）
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const { w, h } = fitSize(bmp.width, bmp.height);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bmp, 0, 0, w, h);
      if (bmp.close) bmp.close();
      let blob = await toBlob(canvas, 'image/webp', QUALITY);
      if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', QUALITY);
      if (!blob || !IMAGE_EXT[blob.type]) return original;
      if (blob.size >= file.size) return original;
      return { blob, ext: IMAGE_EXT[blob.type], type: blob.type };
    } catch {
      return original;
    }
  },
  // 壓縮後上傳到 product-images，回傳公開網址
  async uploadCompressed(file, pathNoExt) {
    const { blob, ext, type } = await window.adminData.compressImage(file);
    const path = `${pathNoExt}.${ext}`;
    const up = await window.sb.storage.from('product-images').upload(path, blob, { upsert: true, contentType: type });
    if (up.error) throw up.error;
    const { data: pub } = window.sb.storage.from('product-images').getPublicUrl(path);
    return pub.publicUrl;
  },
  async uploadImage(file, key) {
    return window.adminData.uploadCompressed(file, `site/${key}-${Date.now()}`);
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
