// 發布時把 Supabase Storage 的公開圖片下載到 media/，跟網站一起部署到 Cloudflare。
// 客人看圖改走 Cloudflare 靜態資產（流量免費、不限量），不再吃 Supabase 的 egress 額度。
//
// - 只處理我們自己 bucket 的公開網址；其他網址原樣保留
// - 檔名沿用 Storage 路徑（上傳時已含時間戳，內容不會變 → 可長快取）
// - 下載失敗就退回原網址（網站照常顯示，只是那張圖還走 Supabase）
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const SAFE_PATH = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;
const IMAGE_EXT = /\.(jpe?g|png|webp|avif|gif)$/i;
const MAX_BYTES = 20 * 1024 * 1024; // Cloudflare 靜態資產單檔上限 25 MiB，留點餘裕

export function mirrorPath(url, base, bucket = 'product-images') {
  if (typeof url !== 'string' || !base) return null;
  const prefix = `${base.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/`;
  if (!url.startsWith(prefix)) return null;
  const rel = decodeURIComponent(url.slice(prefix.length).split(/[?#]/)[0]);
  if (!SAFE_PATH.test(rel) || rel.split('/').includes('..') || !IMAGE_EXT.test(rel)) return null;
  return rel;
}

export function createMirror({ base, outDir = 'media', publicPrefix = '/media', fetchImpl = fetch, log = console } = {}) {
  const done = new Map(); // url -> Promise<string>
  const stats = { mirrored: 0, failed: 0, bytes: 0 };

  async function download(url, rel) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const r = await fetchImpl(url, { signal: AbortSignal.timeout(30_000) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const buf = Buffer.from(await r.arrayBuffer());
        if (!buf.length || buf.length > MAX_BYTES) throw new Error(`bad size ${buf.length}`);
        const file = join(outDir, rel);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, buf);
        stats.mirrored++; stats.bytes += buf.length;
        return `${publicPrefix}/${rel}`;
      } catch (err) {
        if (attempt === 3) {
          stats.failed++;
          log.warn(`mirror failed, keeping Supabase URL: ${rel} (${err.message})`);
          return url;
        }
      }
    }
    return url;
  }

  function mirror(url) {
    const rel = mirrorPath(url, base);
    if (!rel) return Promise.resolve(url);
    if (!done.has(url)) done.set(url, download(url, rel));
    return done.get(url);
  }

  // 併發下載一批網址，回傳 url -> 新網址 的 Map
  async function mirrorAll(urls, concurrency = 6) {
    const list = [...new Set(urls.filter(Boolean))];
    const out = new Map();
    let i = 0;
    const worker = async () => {
      while (i < list.length) {
        const u = list[i++];
        out.set(u, await mirror(u));
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));
    return out;
  }

  return { mirror, mirrorAll, stats };
}
