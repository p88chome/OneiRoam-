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
    () => { applyLang(currentLang === 'zh' ? 'en' : 'zh'); render(); applyGate(); });

  /* 預售日期閘門 */
  const PREORDER_START = '2026-06-23';
  const PREORDER_END = '2026-06-30';
  function preorderStatus(now = new Date()) {
    const day = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');
    if (day < PREORDER_START) return 'before';
    if (day > PREORDER_END) return 'after';
    return 'open';
  }
  function applyGate() {
    const s = preorderStatus();
    const gate = document.getElementById('preorderGate');
    const btn = document.getElementById('submitBtn');
    if (s === 'open') { gate.style.display = 'none'; btn.disabled = false; return; }
    btn.disabled = true;
    gate.style.display = '';
    gate.textContent = s === 'before'
      ? (currentLang === 'zh' ? `預售 ${PREORDER_START} 開始，敬請期待` : `Pre-order opens ${PREORDER_START}`)
      : (currentLang === 'zh' ? '預售已結束' : 'Pre-order has ended');
  }

  /* 渲染清單 */
  // 海的公因數 四款全包 $4320（原價 980+980+1680+1680 = 5320）
  const BUNDLES = [{
    id: 'sea-gcd-all4',
    productIds: ['sea-gcd-short-jelly', 'sea-gcd-short-tear',
                 'sea-gcd-long-jelly', 'sea-gcd-long-tear'],
    flatPrice: 4320,
  }];
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
  async function submitOrder(payload, items, amountType) {
    const res = await fetch(`${window.SUPABASE_URL}/functions/v1/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.SUPABASE_ANON_KEY}` },
      body: JSON.stringify({
        items: items.map(it => ({ id: it.id, size: it.size, qty: it.qty })),
        customer: { name: payload.name, phone: payload.phone, social: payload.social, email: payload.email, notes: payload.notes },
        amount_type: amountType,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'create-order failed');
    const form = document.createElement('form');
    form.method = 'POST'; form.action = data.action;
    for (const [k, v] of Object.entries(data.params)) {
      const inp = document.createElement('input');
      inp.type = 'hidden'; inp.name = k; inp.value = String(v);
      form.appendChild(inp);
    }
    document.body.appendChild(form);
    form.submit();
  }

  const form = document.getElementById('orderForm');
  const submitBtn = document.getElementById('submitBtn');
  const formError = document.getElementById('formError');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    formError.style.display = 'none';

    if (preorderStatus() !== 'open') return;
    const items = Cart.getItems();
    if (items.length === 0) return;
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const fd = new FormData(form);
    const orderNo = makeOrderNo();
    const p = computePricing(items, { bundles: BUNDLES });
    const payload = {
      orderNo,
      total: p.total,
      subtotal: p.subtotal,
      discount: p.discount,
      deposit: p.deposit,
      cod: p.cod,
      name: fd.get('name').trim(),
      phone: fd.get('phone').trim(),
      social: fd.get('social').trim(),
      email: fd.get('email').trim(),
      notes: (fd.get('notes') || '').trim(),
    };

    const amountType = (form.querySelector('input[name="amount_type"]:checked') || {}).value || 'deposit';
    submitBtn.disabled = true;
    const orig = submitBtn.textContent;
    submitBtn.textContent = currentLang === 'zh' ? '前往付款…' : 'Redirecting…';
    try {
      await submitOrder(payload, items, amountType);   // 成功則頁面已跳轉 PAYUNi
    } catch (err) {
      formError.textContent = currentLang === 'zh' ? '建立訂單失敗，請改用 LINE 聯絡我們。' : 'Failed. Contact us via LINE.';
      formError.style.display = '';
      submitBtn.disabled = false;
      submitBtn.textContent = orig;
    }
  });

  applyLang(currentLang);
  render();
  applyGate();
});
