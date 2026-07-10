export const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fmt = n => Number(n).toLocaleString('en-US');

const STATUS = {
  preorder: { cls: 'status-preorder', zh: '預購中', en: 'Pre-order' },
  active:   { cls: 'status-active',   zh: '現貨',   en: 'In Stock' },
  sold_out: { cls: 'status-soldout',  zh: '售罄',   en: 'Sold Out' },
};

export function renderProductCards(products) {
  return products.map(p => {
    const st = STATUS[p.status] || STATUS.preorder;
    return `        <div class="product-card" data-category="${esc(p.category)}"
          data-id="${esc(p.id)}" data-sizes="${esc(p.sizes.join(','))}" data-max-qty="${esc(p.max_qty)}"
          data-modal-img="${esc(p.image)}"
          data-modal-name-zh="${esc(p.name_zh)}" data-modal-name-en="${esc(p.name_en)}"
          data-modal-desc-zh="${esc(p.desc_zh)}" data-modal-desc-en="${esc(p.desc_en)}"
          data-modal-cat-zh="${esc(p.cat_zh)}" data-modal-cat-en="${esc(p.cat_en)}">
          <div class="product-img-wrap">
            ${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name_zh)}" class="product-img" loading="lazy">` : ''}
            <div class="product-hover">
              <button class="btn-inquire open-modal" data-zh="查看詳情" data-en="View Details">查看詳情</button>
            </div>
            <span class="product-badge" data-zh="${esc(p.badge_zh)}" data-en="${esc(p.badge_en)}">${esc(p.badge_zh)}</span>
          </div>
          <div class="product-info">
            <h3 data-zh="${esc(p.name_zh)}" data-en="${esc(p.name_en)}">${esc(p.name_zh)}</h3>
            <p data-zh="${esc(p.desc_zh)}" data-en="${esc(p.desc_en)}">${esc(p.desc_zh)}</p>
            <span class="product-price">NT$ ${fmt(p.price)}</span>
            <div class="product-meta">
              <span class="product-tag ${esc(p.category)}-tag" data-zh="${esc(p.cat_zh)}" data-en="${esc(p.cat_en)}">${esc(p.cat_zh)}</span>
              <span class="product-status ${st.cls}" data-zh="${st.zh}" data-en="${st.en}">${st.zh}</span>
            </div>
          </div>
        </div>`;
  }).join('\n\n');
}

export function buildStorefrontData(settings) {
  return {
    deposit_rate: parseFloat(settings.deposit_rate ?? '0.5'),
    bank: {
      name: settings.bank_name ?? '', code: settings.bank_code ?? '',
      account: settings.bank_account ?? '', holder: settings.bank_holder ?? '',
    },
    preorder: { start: settings.preorder_start ?? '', end: settings.preorder_end ?? '' },
  };
}
