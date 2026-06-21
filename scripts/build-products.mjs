// scripts/build-products.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { renderProductCards, buildStorefrontData } from './render-products.mjs';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }

const rest = path => fetch(`${URL}/rest/v1/${path}`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
}).then(r => { if (!r.ok) throw new Error(`${path} ${r.status}`); return r.json(); });

const MAP_CAT = { top: ['上衣', 'Top'], dress: ['洋裝', 'Dress'], bag: ['包款', 'Bag'] };

const products = await rest('products?status=neq.hidden&order=sort_order.asc&select=*');
const variants = await rest('product_variants?select=*');
const images   = await rest('product_images?order=sort_order.asc&select=*');
const settingsRows = await rest('settings?select=*');

const settings = Object.fromEntries(settingsRows.map(s => [s.key, s.value]));

const normalized = products.map(p => {
  const vs = variants.filter(v => v.product_id === p.id);
  const img = images.find(i => i.product_id === p.id);
  const [cat_zh, cat_en] = MAP_CAT[p.category] || ['上衣', 'Top'];
  return {
    id: p.id, category: p.category, price: p.price,
    name_zh: p.name_zh, name_en: p.name_en, desc_zh: p.desc_zh, desc_en: p.desc_en,
    badge_zh: p.badge_zh, badge_en: p.badge_en, cat_zh, cat_en,
    status: vs.length && vs.every(v => v.stock <= 0) ? 'sold_out' : p.status,
    image: img ? img.url : '/favicon.svg',
    sizes: vs.map(v => v.size), max_qty: vs.length ? Math.min(...vs.map(v => v.max_qty)) : 1,
  };
});

const cardsHtml = renderProductCards(normalized);

const START = '<!-- BUILD:PRODUCTS:START -->';
const END = '<!-- BUILD:PRODUCTS:END -->';
const html = await readFile('index.html', 'utf8');
const re = new RegExp(`${START}[\\s\\S]*?${END}`);
if (!re.test(html)) { console.error('build markers not found in index.html'); process.exit(1); }
const out = html.replace(re, `${START}\n${cardsHtml}\n        ${END}`);
await writeFile('index.html', out);

await writeFile('data/storefront.json', JSON.stringify(buildStorefrontData(settings), null, 2));
console.log(`built ${normalized.length} products`);
