document.addEventListener('DOMContentLoaded', () => {
  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* 語言（與首頁同套） */
  let currentLang = localStorage.getItem('oneiRoamLang') || 'zh';
  function applyLang(lang) {
    currentLang = lang;
    document.documentElement.lang = lang === 'zh' ? 'zh-TW' : 'en';
    document.body.setAttribute('data-lang', lang);
    document.querySelectorAll('[data-zh]').forEach(el => {
      const t = lang === 'zh' ? el.dataset.zh : el.dataset.en;
      if (t !== undefined) el.textContent = t;
    });
    document.querySelectorAll('.l-zh').forEach(el => el.classList.toggle('active', lang === 'zh'));
    document.querySelectorAll('.l-en').forEach(el => el.classList.toggle('active', lang === 'en'));
    localStorage.setItem('oneiRoamLang', lang);
  }
  document.getElementById('langToggle').addEventListener('click',
    () => { applyLang(currentLang === 'zh' ? 'en' : 'zh'); render(); });

  /* 渲染清單 */
  const BUNDLES = []; // Plan D：改由 Supabase 載入
  const listEl  = document.getElementById('cartList');
  const emptyEl = document.getElementById('cartEmpty');
  const areaEl  = document.getElementById('cartArea');
  const fmt = n => n.toLocaleString();

  function render() {
    const items = Cart.getItems();
    if (items.length === 0) {
      emptyEl.style.display = '';
      areaEl.style.display = 'none';
      applyLang(currentLang);
      return;
    }
    emptyEl.style.display = 'none';
    areaEl.style.display = '';
    listEl.innerHTML = items.map(it => `
      <div class="cart-row" data-id="${esc(it.id)}" data-size="${esc(it.size)}">
        <div class="cart-row-info">
          <span class="cart-row-name">${esc(it.name)}</span>
          <span class="cart-row-size">${currentLang === 'zh' ? '尺寸' : 'Size'}: ${esc(it.size)}</span>
          <span class="cart-row-price">NT$ ${it.price.toLocaleString()}</span>
        </div>
        <div class="cart-row-qty">
          <button type="button" class="qminus" aria-label="減少">−</button>
          <span class="qval">${it.qty}</span>
          <button type="button" class="qplus" aria-label="增加"
            ${it.maxQty && it.qty >= it.maxQty ? 'disabled' : ''}>+</button>
        </div>
        <button type="button" class="cart-row-del" aria-label="刪除">×</button>
      </div>`).join('');
    const p = computePricing(Cart.getItems(), { bundles: BUNDLES });
    document.getElementById('sumSubtotal').textContent = fmt(p.subtotal);
    document.getElementById('sumDiscount').textContent = fmt(p.discount);
    document.getElementById('sumDiscountRow').style.display = p.discount > 0 ? '' : 'none';
    document.getElementById('sumTotal').textContent = fmt(p.total);
    document.getElementById('sumDeposit').textContent = fmt(p.deposit);
    document.getElementById('sumCod').textContent = fmt(p.cod);
    applyLang(currentLang);
  }

  /* 事件委派：加減 / 刪除 */
  listEl.addEventListener('click', e => {
    const row = e.target.closest('.cart-row');
    if (!row) return;
    const { id, size } = row.dataset;
    const cur = Cart.getItems().find(it => it.id === id && it.size === size);
    if (!cur) return;
    if (e.target.classList.contains('qminus')) Cart.updateQty(id, size, cur.qty - 1);
    else if (e.target.classList.contains('qplus')) {
      if (cur.maxQty && cur.qty >= cur.maxQty) return;
      Cart.updateQty(id, size, cur.qty + 1);
    }
    else if (e.target.classList.contains('cart-row-del')) Cart.remove(id, size);
    else return;
    render();
  });

  /* ---- 送出 ---- */
  const WEB3FORMS_KEY = '4145687f-468f-489d-ab01-6e1d95d5f5b9';

  function buildItemsText(items) {
    return items.map(it =>
      `- ${it.name} / ${currentLang === 'zh' ? '尺寸' : 'Size'} ${it.size} x${it.qty} = NT$ ${it.price * it.qty}`
    ).join('\n');
  }

  async function submitOrder(payload) {
    const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_key: WEB3FORMS_KEY,
        subject: `新訂單 ${payload.orderNo}`,
        from_name: 'OneiRoam 訂單',
        replyto: payload.email,
        order_no: payload.orderNo,
        items: payload.itemsText,
        total: payload.total,
        deposit: payload.deposit,
        cod: payload.cod,
        name: payload.name,
        address: payload.address,
        contact: payload.contact,
        email: payload.email,
        notes: payload.notes,
      }),
    });
    if (!res.ok) throw new Error('submit failed');
    const data = await res.json();
    if (!data.success) throw new Error('web3forms error');
    return data;
  }

  const form = document.getElementById('orderForm');
  const submitBtn = document.getElementById('submitBtn');
  const formError = document.getElementById('formError');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    formError.style.display = 'none';

    const items = Cart.getItems();
    if (items.length === 0) return;
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const fd = new FormData(form);
    const orderNo = makeOrderNo();
    const p = computePricing(items, { bundles: BUNDLES });
    const payload = {
      orderNo,
      itemsText: buildItemsText(items),
      total: p.total,
      subtotal: p.subtotal,
      discount: p.discount,
      deposit: p.deposit,
      cod: p.cod,
      name: fd.get('name').trim(),
      address: fd.get('address').trim(),
      contact: fd.get('contact').trim(),
      email: fd.get('email').trim(),
      notes: (fd.get('notes') || '').trim(),
    };

    submitBtn.disabled = true;
    const orig = submitBtn.textContent;
    submitBtn.textContent = currentLang === 'zh' ? '送出中…' : 'Sending…';
    try {
      await submitOrder(payload);
      document.getElementById('resultOrderNo').textContent = orderNo;
      document.getElementById('cartArea').style.display = 'none';
      document.getElementById('orderSuccess').style.display = '';
      Cart.clear();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      formError.textContent = currentLang === 'zh'
        ? '送出失敗，請改用 LINE 直接聯絡我們。'
        : 'Submission failed. Please contact us via LINE.';
      formError.style.display = '';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = orig;
    }
  });

  applyLang(currentLang);
  render();
});
