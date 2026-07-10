// scripts/build-products.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { renderProductCards, buildStorefrontData } from './render-products.mjs';
import { catLabel, splitProducts, SELECT_EMPTY_HTML } from './categories.mjs';

const BASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!BASE_URL || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }

const rest = path => fetch(`${BASE_URL}/rest/v1/${path}`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
}).then(r => { if (!r.ok) throw new Error(`${path} ${r.status}`); return r.json(); });

let products, variants, images, settingsRows;
try {
  [products, variants, images, settingsRows] = await Promise.all([
    rest('products?status=neq.hidden&order=sort_order.asc&select=*'),
    rest('product_variants?select=*'),
    rest('product_images?order=sort_order.asc&select=*'),
    rest('settings?select=*'),
  ]);
} catch (err) {
  console.error(`Supabase fetch failed: ${err.message}`);
  process.exit(1);
}

const settings = Object.fromEntries(settingsRows.map(s => [s.key, s.value]));

const normalized = products.map(p => {
  const vs = variants.filter(v => v.product_id === p.id);
  const img = images.find(i => i.product_id === p.id);
  const [cat_zh, cat_en] = catLabel(p.category);
  return {
    id: p.id, category: p.category, price: p.price,
    name_zh: p.name_zh, name_en: p.name_en, desc_zh: p.desc_zh, desc_en: p.desc_en,
    badge_zh: p.badge_zh, badge_en: p.badge_en, cat_zh, cat_en,
    status: vs.length && vs.every(v => v.stock <= 0) ? 'sold_out' : p.status,
    image: img ? img.url : '/favicon.svg',
    sizes: vs.map(v => v.size), max_qty: vs.length ? Math.min(...vs.map(v => v.max_qty)) : 1,
  };
});

const { original, select } = splitProducts(normalized);
const cardsHtml = renderProductCards(original);
const selectHtml = select.length ? renderProductCards(select) : `        ${SELECT_EMPTY_HTML}`;

// SEO：每個商品的 Product 結構化資料（Google 富摘要：價格/庫存）
const AVAIL = { sold_out: 'OutOfStock', active: 'InStock', preorder: 'PreOrder' };
const jsonld = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  itemListElement: normalized.map((p, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: {
      '@type': 'Product',
      name: p.name_zh,
      ...(p.name_en ? { alternateName: p.name_en } : {}),
      ...(p.desc_zh ? { description: p.desc_zh } : {}),
      image: `https://www.oneiroam.com${p.image}`,
      brand: { '@type': 'Brand', name: 'OneiRoam' },
      offers: {
        '@type': 'Offer',
        priceCurrency: 'TWD',
        price: String(p.price),
        availability: `https://schema.org/${AVAIL[p.status] || 'PreOrder'}`,
        url: 'https://www.oneiroam.com/#products',
      },
    },
  })),
};
// </script> 防注入：JSON 內的 < 一律轉 <
const jsonldTag = `<script type="application/ld+json">\n${
  JSON.stringify(jsonld, null, 2).replace(/</g, '\\u003c')
}\n  </script>`;

const START = '<!-- BUILD:PRODUCTS:START -->';
const END = '<!-- BUILD:PRODUCTS:END -->';
const html = await readFile('index.html', 'utf8');
const re = new RegExp(`${START}[\\s\\S]*?${END}`);
if (!re.test(html)) { console.error('build markers not found in index.html'); process.exit(1); }
let out = html.replace(re, `${START}\n${cardsHtml}\n        ${END}`);

const SSTART = '<!-- BUILD:SELECT:START -->';
const SEND = '<!-- BUILD:SELECT:END -->';
const sre = new RegExp(`${SSTART}[\\s\\S]*?${SEND}`);
if (sre.test(out)) out = out.replace(sre, `${SSTART}\n${selectHtml}\n        ${SEND}`);
else console.warn('SELECT markers not found in index.html — skipping select goods');

const JSTART = '<!-- BUILD:JSONLD:START -->';
const JEND = '<!-- BUILD:JSONLD:END -->';
const jre = new RegExp(`${JSTART}[\\s\\S]*?${JEND}`);
if (jre.test(out)) out = out.replace(jre, `${JSTART}\n  ${jsonldTag}\n  ${JEND}`);
else console.warn('JSONLD markers not found in index.html — skipping product structured data');

await writeFile('index.html', out);

await writeFile('data/storefront.json', JSON.stringify(buildStorefrontData(settings), null, 2));
console.log(`built ${original.length} original + ${select.length} select products`);
