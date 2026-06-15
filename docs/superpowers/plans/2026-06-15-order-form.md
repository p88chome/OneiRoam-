# 訂單表單 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在靜態網站新增多商品站內訂購功能：localStorage 訂單清單 + Web3Forms email 送出 + 訂單編號人工對帳。

**Architecture:** 純前端，無後端。`cart.js` 為訂單清單單一資料來源（localStorage），商品卡與訂購頁兩個 UI 共用。送出邏輯獨立成 `submitOrder()` 以利未來換通道。純邏輯用 `node --test` 做 TDD；DOM/UI 用瀏覽器手動驗證。

**Tech Stack:** HTML5 + CSS3 + Vanilla JS（無建置）。測試：Node ≥20 內建 `node:test`（零依賴）。送出：Web3Forms。

---

## File Structure

```
新增
├── order.html                          訂購頁
├── cart.js                             訂單清單邏輯（單一資料來源，瀏覽器+node 雙用）
├── order.js                            訂購頁：渲染清單、表單、送出
└── tests/cart.test.js                  cart.js 與訂單編號單元測試

改動
├── index.html                          商品卡加 data-id/data-sizes/「加入訂單」鈕；header 加購物袋 badge；CSP 加 Web3Forms
├── script.js                           商品卡鈕 → cart.addItem；badge 初始化
└── style.css                           鈕、badge、訂購頁、清單樣式
```

測試執行：專案根目錄 `node --test`

---

### Task 1: cart.js — 訂單清單核心邏輯（TDD）

`cart.js` 須在瀏覽器（掛 `window.Cart`）與 Node 測試（`require`）皆可用，並用注入式 storage 以便測試。

**Files:**
- Create: `cart.js`
- Test: `tests/cart.test.js`

- [ ] **Step 1: 寫失敗測試**

`tests/cart.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');
const { createCart } = require('../cart.js');

function memStorage() {
  let store = {};
  return {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
}

test('addItem 新增一筆', () => {
  const cart = createCart(memStorage());
  cart.addItem({ id: 'a', name: '花嫁之夢', price: 1690, size: 'M', qty: 1 });
  assert.deepStrictEqual(cart.getItems(), [
    { id: 'a', name: '花嫁之夢', price: 1690, size: 'M', qty: 1 },
  ]);
});

test('同 id+size 再加 → qty 累加，不新增列', () => {
  const cart = createCart(memStorage());
  cart.addItem({ id: 'a', name: 'X', price: 100, size: 'M', qty: 1 });
  cart.addItem({ id: 'a', name: 'X', price: 100, size: 'M', qty: 2 });
  assert.strictEqual(cart.getItems().length, 1);
  assert.strictEqual(cart.getItems()[0].qty, 3);
});

test('不同 size 視為不同列', () => {
  const cart = createCart(memStorage());
  cart.addItem({ id: 'a', name: 'X', price: 100, size: 'M', qty: 1 });
  cart.addItem({ id: 'a', name: 'X', price: 100, size: 'L', qty: 1 });
  assert.strictEqual(cart.getItems().length, 2);
});

test('updateQty 改數量；設 0 移除該列', () => {
  const cart = createCart(memStorage());
  cart.addItem({ id: 'a', name: 'X', price: 100, size: 'M', qty: 1 });
  cart.updateQty('a', 'M', 5);
  assert.strictEqual(cart.getItems()[0].qty, 5);
  cart.updateQty('a', 'M', 0);
  assert.strictEqual(cart.getItems().length, 0);
});

test('updateSize 改尺寸', () => {
  const cart = createCart(memStorage());
  cart.addItem({ id: 'a', name: 'X', price: 100, size: 'M', qty: 1 });
  cart.updateSize('a', 'M', 'XL');
  assert.strictEqual(cart.getItems()[0].size, 'XL');
});

test('remove 刪除指定列', () => {
  const cart = createCart(memStorage());
  cart.addItem({ id: 'a', name: 'X', price: 100, size: 'M', qty: 1 });
  cart.remove('a', 'M');
  assert.strictEqual(cart.getItems().length, 0);
});

test('count 為所有 qty 總和', () => {
  const cart = createCart(memStorage());
  cart.addItem({ id: 'a', name: 'X', price: 100, size: 'M', qty: 2 });
  cart.addItem({ id: 'b', name: 'Y', price: 50, size: 'F', qty: 3 });
  assert.strictEqual(cart.count(), 5);
});

test('total 為 price*qty 總和', () => {
  const cart = createCart(memStorage());
  cart.addItem({ id: 'a', name: 'X', price: 100, size: 'M', qty: 2 });
  cart.addItem({ id: 'b', name: 'Y', price: 50, size: 'F', qty: 3 });
  assert.strictEqual(cart.total(), 350);
});

test('clear 清空', () => {
  const cart = createCart(memStorage());
  cart.addItem({ id: 'a', name: 'X', price: 100, size: 'M', qty: 1 });
  cart.clear();
  assert.strictEqual(cart.getItems().length, 0);
});

test('持久化：第二個 cart 實例讀到同 storage 資料', () => {
  const s = memStorage();
  const c1 = createCart(s);
  c1.addItem({ id: 'a', name: 'X', price: 100, size: 'M', qty: 1 });
  const c2 = createCart(s);
  assert.strictEqual(c2.getItems().length, 1);
});

test('壞掉的 JSON 不爆，回空陣列', () => {
  const s = memStorage();
  s.setItem('oneiRoamCart', '{not json');
  const cart = createCart(s);
  assert.deepStrictEqual(cart.getItems(), []);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test`
Expected: FAIL — `Cannot find module '../cart.js'`

- [ ] **Step 3: 寫最小實作**

`cart.js`:
```js
(function (global) {
  const KEY = 'oneiRoamCart';

  function createCart(storage) {
    function read() {
      try {
        const raw = storage.getItem(KEY);
        const data = raw ? JSON.parse(raw) : [];
        return Array.isArray(data) ? data : [];
      } catch (e) {
        return [];
      }
    }
    function write(items) {
      storage.setItem(KEY, JSON.stringify(items));
    }
    function findIndex(items, id, size) {
      return items.findIndex(it => it.id === id && it.size === size);
    }

    return {
      getItems() { return read(); },
      addItem({ id, name, price, size, qty }) {
        const items = read();
        const i = findIndex(items, id, size);
        if (i >= 0) items[i].qty += qty;
        else items.push({ id, name, price, size, qty });
        write(items);
      },
      updateQty(id, size, qty) {
        let items = read();
        const i = findIndex(items, id, size);
        if (i < 0) return;
        if (qty <= 0) items.splice(i, 1);
        else items[i].qty = qty;
        write(items);
      },
      updateSize(id, size, newSize) {
        const items = read();
        const i = findIndex(items, id, size);
        if (i < 0) return;
        items[i].size = newSize;
        write(items);
      },
      remove(id, size) {
        const items = read().filter(it => !(it.id === id && it.size === size));
        write(items);
      },
      count() { return read().reduce((n, it) => n + it.qty, 0); },
      total() { return read().reduce((n, it) => n + it.price * it.qty, 0); },
      clear() { write([]); },
    };
  }

  // 瀏覽器：掛 window.Cart（用真實 localStorage）
  if (typeof window !== 'undefined') {
    global.Cart = createCart(window.localStorage);
    global.createCart = createCart;
  }
  // Node 測試
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createCart };
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test`
Expected: PASS（11 tests）

- [ ] **Step 5: Commit**

```bash
git add cart.js tests/cart.test.js
git commit -m "feat: add cart module (localStorage order list)"
```

---

### Task 2: 訂單編號產生器（TDD）

放進 `cart.js` 一起匯出，邏輯純函式好測。

**Files:**
- Modify: `cart.js`
- Test: `tests/cart.test.js`

- [ ] **Step 1: 寫失敗測試**（append 到 `tests/cart.test.js`）

```js
const { makeOrderNo } = require('../cart.js');

test('訂單編號格式 OR-YYYYMMDD-XXX', () => {
  const no = makeOrderNo(new Date('2026-06-15T10:00:00'));
  assert.match(no, /^OR-20260615-[0-9A-Z]{3}$/);
});

test('連續產生不重複（機率）', () => {
  const d = new Date('2026-06-15T10:00:00');
  const set = new Set(Array.from({ length: 50 }, () => makeOrderNo(d)));
  assert.ok(set.size > 45);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test`
Expected: FAIL — `makeOrderNo is not a function`

- [ ] **Step 3: 實作**（加進 `cart.js` 的 IIFE 內，export 區改成同時匯出）

在 `createCart` 後加：
```js
  function makeOrderNo(date = new Date()) {
    const p = n => String(n).padStart(2, '0');
    const d = `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}`;
    const rnd = Math.random().toString(36).slice(2, 5).toUpperCase().padEnd(3, 'X');
    return `OR-${d}-${rnd}`;
  }
```
改瀏覽器區：`global.makeOrderNo = makeOrderNo;`
改 Node 區：`module.exports = { createCart, makeOrderNo };`

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test`
Expected: PASS（13 tests）

- [ ] **Step 5: Commit**

```bash
git add cart.js tests/cart.test.js
git commit -m "feat: add order number generator"
```

---

### Task 3: 商品卡加 data-id / data-sizes

為 6 張商品卡補 `data-id`（cart 用）與 `data-sizes`（尺寸選項）。

**Files:**
- Modify: `index.html`（6 個 `.product-card`，約 line 177-324）

- [ ] **Step 1: 改 6 張卡**

每張 `<div class="product-card" ...>` 加 `data-id` 與 `data-sizes`：
```
1 花嫁之夢:     data-id="dress-white-lace"  data-sizes="S,M,L,XL"
2 夢雲粉:       data-id="top-mesh-pink"     data-sizes="S,M,L,XL"
3 夢雲藍:       data-id="top-mesh-blue"     data-sizes="S,M,L,XL"
4 雲朵荷葉包白: data-id="bag-ruffle-white"  data-sizes="F"
5 雲朵荷葉包藍: data-id="bag-ruffle-blue"   data-sizes="F"
6 蕾絲花圃套裝: data-id="top-lace-set"      data-sizes="S,M,L,XL"
```
範例（第 1 張）：
```html
<div class="product-card" data-category="dress"
  data-id="dress-white-lace" data-sizes="S,M,L,XL"
  data-modal-img="images/products/dress-white-lace.jpg"
  ...保留其餘 data-modal-* 不動>
```

- [ ] **Step 2: 瀏覽器驗證**

開 `index.html`，DevTools Console 跑：
```js
[...document.querySelectorAll('.product-card')].map(c => [c.dataset.id, c.dataset.sizes])
```
Expected: 6 組皆有 id 與 sizes，無 undefined。

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add data-id and data-sizes to product cards"
```

---

### Task 4: 商品卡「加入訂單」鈕 + 尺寸選擇

在 modal 內加尺寸下拉（含「自訂」→ 顯示文字框）+「加入訂單」鈕，呼叫 `Cart.addItem`。

**Files:**
- Modify: `index.html`（modal 區 line 446-466；`<head>` 引入 cart.js）
- Modify: `script.js`（modal 開啟時填尺寸；加入鈕 handler）

- [ ] **Step 1: index.html 引入 cart.js（在 script.js 之前）**

line 468 `<script src="script.js"></script>` 上方加：
```html
  <script src="cart.js"></script>
```

- [ ] **Step 2: modal-info 內加尺寸選擇 + 加入鈕**（`<p class="modal-note">` 上方）

```html
          <div class="modal-order">
            <label class="modal-size-label" data-zh="尺寸" data-en="Size">尺寸</label>
            <select id="modalSize" class="modal-size-select"></select>
            <input id="modalSizeCustom" class="modal-size-custom" type="text"
                   placeholder="輸入自訂尺寸" style="display:none" maxlength="40">
            <div class="modal-qty">
              <button type="button" id="modalQtyMinus" aria-label="減少">−</button>
              <span id="modalQty">1</span>
              <button type="button" id="modalQtyPlus" aria-label="增加">+</button>
            </div>
            <button id="modalAdd" class="btn-primary"
                    data-zh="加入訂單" data-en="Add to Order">加入訂單</button>
            <span id="modalAdded" class="modal-added" style="display:none"
                  data-zh="已加入 ✓" data-en="Added ✓">已加入 ✓</span>
          </div>
```

- [ ] **Step 3: script.js — openModal 內填尺寸選項與重置數量**

在 `openModal(card)` 內（line 168-179），`modal.classList.add('open')` 之前加：
```js
    // 尺寸選項
    const sizeSel = document.getElementById('modalSize');
    const sizes = (card.dataset.sizes || 'S,M,L,XL').split(',');
    const customLabel = lang === 'zh' ? '自訂' : 'Custom';
    sizeSel.innerHTML = sizes.map(s => `<option value="${s}">${s}</option>`).join('')
      + `<option value="__custom">${customLabel}</option>`;
    document.getElementById('modalSizeCustom').style.display = 'none';
    document.getElementById('modalSizeCustom').value = '';
    document.getElementById('modalQty').textContent = '1';
    document.getElementById('modalAdded').style.display = 'none';
    document.getElementById('modalAdd').style.display = '';
    // 暫存目前商品供加入鈕使用
    modal.dataset.curId = card.dataset.id;
    modal.dataset.curName = lang === 'zh' ? card.dataset.modalNameZh : card.dataset.modalNameEn;
    const priceText = card.querySelector('.product-price').textContent;
    modal.dataset.curPrice = priceText.replace(/[^0-9]/g, '');
```

- [ ] **Step 4: script.js — PRODUCT MODAL 區末尾加互動 handler**

在 line 195（Escape handler）下方加：
```js
  // 尺寸：選「自訂」顯示文字框
  document.getElementById('modalSize').addEventListener('change', e => {
    document.getElementById('modalSizeCustom').style.display =
      e.target.value === '__custom' ? '' : 'none';
  });
  // 數量加減
  const qtyEl = document.getElementById('modalQty');
  document.getElementById('modalQtyMinus').addEventListener('click', () => {
    qtyEl.textContent = Math.max(1, parseInt(qtyEl.textContent, 10) - 1);
  });
  document.getElementById('modalQtyPlus').addEventListener('click', () => {
    qtyEl.textContent = parseInt(qtyEl.textContent, 10) + 1;
  });
  // 加入訂單
  document.getElementById('modalAdd').addEventListener('click', () => {
    const sel = document.getElementById('modalSize');
    let size = sel.value;
    if (size === '__custom') {
      size = document.getElementById('modalSizeCustom').value.trim();
      if (!size) { document.getElementById('modalSizeCustom').focus(); return; }
    }
    Cart.addItem({
      id: modal.dataset.curId,
      name: modal.dataset.curName,
      price: parseInt(modal.dataset.curPrice, 10) || 0,
      size,
      qty: parseInt(qtyEl.textContent, 10),
    });
    updateCartBadge();
    document.getElementById('modalAdd').style.display = 'none';
    document.getElementById('modalAdded').style.display = '';
  });
```
（`updateCartBadge` 於 Task 5 定義；Task 5 與本 Task 一起完成後再驗證。）

- [ ] **Step 5: 提交（與 Task 5 合併驗證）**

```bash
git add index.html script.js
git commit -m "feat: add size picker and add-to-order button in product modal"
```

---

### Task 5: Header 購物袋 icon + 數量 badge

**Files:**
- Modify: `index.html`（header line 66-70 lang-toggle 旁）
- Modify: `script.js`（`updateCartBadge` + 初始化）

- [ ] **Step 1: header 加購物袋連結**（`lang-toggle` 按鈕後）

```html
      <a href="order.html" class="cart-link" aria-label="訂單" id="cartLink">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="22" height="22">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
          <path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>
        </svg>
        <span class="cart-badge" id="cartBadge" style="display:none">0</span>
      </a>
```

- [ ] **Step 2: script.js 加 updateCartBadge 並於 DOMContentLoaded 末尾呼叫**

在 PRODUCT MODAL 區上方（或檔案內任一頂層）加：
```js
  function updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    if (!badge) return;
    const n = Cart.count();
    badge.textContent = n;
    badge.style.display = n > 0 ? '' : 'none';
  }
```
並在 `applyLang(currentLang);`（line 71）下方加一行：
```js
  updateCartBadge();
```

- [ ] **Step 3: 瀏覽器驗證（Task 4+5 一起）**

1. 開 `index.html` → 點商品「查看詳情」→ 選尺寸 → 加數量 → 「加入訂單」。
2. 鈕變「已加入 ✓」，header badge 顯示數量。
3. 再加不同商品/尺寸 → badge 累加。
4. Console: `Cart.getItems()` 內容正確。
5. 重新整理頁面 → badge 數字保留（localStorage 持久）。

- [ ] **Step 4: Commit**

```bash
git add index.html script.js
git commit -m "feat: add cart badge in header"
```

---

### Task 6: order.html 頁面骨架

複製 index.html 的 header/footer/loader 結構，主體放清單區 + 表單 + 結果區。

**Files:**
- Create: `order.html`

- [ ] **Step 1: 建 order.html**

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="OneiRoam 夢遊 — 訂購頁">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.web3forms.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'">
  <title>OneiRoam — 訂購</title>
  <link rel="icon" type="image/svg+xml" href="favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Noto+Sans+TC:wght@300;400;500&family=Noto+Serif+TC:ital,wght@0,300;1,300&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
</head>
<body data-lang="zh">
  <header id="header" class="scrolled">
    <div class="header-inner">
      <a href="index.html" class="logo">
        <span class="logo-brand">OneiRoam</span>
        <span class="logo-sub" data-zh="夢遊" data-en="Wander Through Dreams">夢遊</span>
      </a>
      <nav id="main-nav">
        <a href="index.html#collections" data-zh="繼續逛" data-en="Keep Shopping">繼續逛</a>
      </nav>
      <button class="lang-toggle" id="langToggle" aria-label="語言切換">
        <span class="l-zh active">中</span><span class="l-div">|</span><span class="l-en">EN</span>
      </button>
    </div>
  </header>

  <main class="order-page">
    <div class="container">
      <div class="section-header">
        <p class="section-label" data-zh="訂單確認" data-en="Your Order">訂單確認</p>
        <h2 data-zh="完成妳的夢境訂購" data-en="Complete Your Order">完成妳的夢境訂購</h2>
      </div>

      <!-- 清單 -->
      <div id="cartEmpty" class="cart-empty" style="display:none">
        <p data-zh="訂單是空的" data-en="Your order is empty">訂單是空的</p>
        <a href="index.html#collections" class="btn-primary" data-zh="去逛逛" data-en="Browse Collections">去逛逛</a>
      </div>

      <div id="cartArea">
        <div id="cartList" class="cart-list"></div>
        <div class="cart-total">
          <span data-zh="合計" data-en="Total">合計</span>
          <span class="cart-total-amt">NT$ <span id="cartTotal">0</span></span>
        </div>

        <!-- 表單 -->
        <form id="orderForm" class="order-form" novalidate>
          <h3 data-zh="收件資訊" data-en="Delivery Info">收件資訊</h3>
          <label><span data-zh="姓名" data-en="Name">姓名</span>
            <input name="name" type="text" required maxlength="60"></label>
          <label><span data-zh="收件地址" data-en="Address">收件地址</span>
            <input name="address" type="text" required maxlength="200"></label>
          <label><span data-zh="LINE ID / 電話" data-en="LINE ID / Phone">LINE ID / 電話</span>
            <input name="contact" type="text" required maxlength="60"></label>
          <label><span data-zh="Email（收訂單副本）" data-en="Email (order copy)">Email（收訂單副本）</span>
            <input name="email" type="email" required maxlength="120"></label>
          <label><span data-zh="備註" data-en="Notes">備註</span>
            <textarea name="notes" maxlength="500"></textarea></label>
          <button type="submit" id="submitBtn" class="btn-primary"
                  data-zh="送出訂單" data-en="Place Order">送出訂單</button>
          <p id="formError" class="form-error" style="display:none"></p>
        </form>
      </div>

      <!-- 成功結果 -->
      <div id="orderSuccess" class="order-success" style="display:none">
        <p class="success-mark">✦</p>
        <h3 data-zh="訂單已送出" data-en="Order Received">訂單已送出</h3>
        <p data-zh="訂單編號" data-en="Order Number">訂單編號</p>
        <p class="order-no" id="resultOrderNo"></p>
        <div class="bank-info">
          <p data-zh="請匯款至以下帳戶，並於備註填入訂單編號：" data-en="Please transfer to the account below, noting your order number:">請匯款至以下帳戶，並於備註填入訂單編號：</p>
          <pre id="bankInfo" class="bank-detail">【銀行】___________
【戶名】___________
【帳號】___________</pre>
        </div>
        <p class="success-note" data-zh="匯款後請透過 LINE 傳送收據與訂單編號，我們確認後出貨。" data-en="After transfer, please send the receipt and order number via LINE.">匯款後請透過 LINE 傳送收據與訂單編號，我們確認後出貨。</p>
        <a href="https://line.me/R/ti/p/@547hgbaz" class="btn-line" target="_blank" rel="noopener noreferrer">
          <span data-zh="開啟 LINE 傳收據" data-en="Open LINE">開啟 LINE 傳收據</span>
        </a>
        <a href="index.html" class="back-home" data-zh="返回首頁" data-en="Back to Home">返回首頁</a>
      </div>
    </div>
  </main>

  <footer id="footer">
    <div class="footer-inner">
      <p class="footer-copy" data-zh="© 2026 OneiRoam. 保留所有權利。" data-en="© 2026 OneiRoam. All rights reserved.">© 2026 OneiRoam. 保留所有權利。</p>
    </div>
  </footer>

  <script src="cart.js"></script>
  <script src="order.js"></script>
</body>
</html>
```
注意：`bankInfo` 與 `access_key`（order.js）為佔位，待使用者提供後填入。

- [ ] **Step 2: 瀏覽器驗證**

開 `order.html` → 版面載入無錯（清單空白先不管，下個 Task 接邏輯），header/footer 正常，字體正常。

- [ ] **Step 3: Commit**

```bash
git add order.html
git commit -m "feat: add order page skeleton"
```

---

### Task 7: order.js — 渲染清單 + 編輯 + 雙語

**Files:**
- Create: `order.js`

- [ ] **Step 1: 建 order.js（清單渲染 + 數量/尺寸/刪除 + 語言）**

```js
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
  const listEl  = document.getElementById('cartList');
  const totalEl = document.getElementById('cartTotal');
  const emptyEl = document.getElementById('cartEmpty');
  const areaEl  = document.getElementById('cartArea');

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
          <span class="cart-row-price">NT$ ${it.price}</span>
        </div>
        <div class="cart-row-qty">
          <button type="button" class="qminus" aria-label="減少">−</button>
          <span class="qval">${it.qty}</span>
          <button type="button" class="qplus" aria-label="增加">+</button>
        </div>
        <button type="button" class="cart-row-del" aria-label="刪除">×</button>
      </div>`).join('');
    totalEl.textContent = Cart.total().toLocaleString();
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
    else if (e.target.classList.contains('qplus')) Cart.updateQty(id, size, cur.qty + 1);
    else if (e.target.classList.contains('cart-row-del')) Cart.remove(id, size);
    else return;
    render();
  });

  applyLang(currentLang);
  render();

  // 供 Task 8 使用
  window.__orderRender = render;
  window.__orderEsc = esc;
  window.__getLang = () => currentLang;
});
```

- [ ] **Step 2: 瀏覽器驗證**

1. 首頁加幾件 → 點 header 購物袋進 order.html。
2. 清單顯示品項、尺寸、價格；合計正確。
3. +/− 改數量，合計即時更新；數量到 0 該列消失。
4. × 刪除整列。全刪光 → 顯示「訂單是空的」。
5. 切換中/EN，欄位文字與「尺寸」標籤跟著變。

- [ ] **Step 3: Commit**

```bash
git add order.js
git commit -m "feat: render and edit order list on order page"
```

---

### Task 8: order.js — 表單送出（Web3Forms）+ 結果畫面

**Files:**
- Modify: `order.js`

- [ ] **Step 1: 在 order.js 的 DOMContentLoaded 內、render() 呼叫前加送出邏輯**

```js
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
    const payload = {
      orderNo,
      itemsText: buildItemsText(items),
      total: Cart.total(),
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
```

- [ ] **Step 2: 暫時測試送出（用測試 key 或 mock）**

註冊取得 Web3Forms key 前，先驗證流程：DevTools Network 開啟，填表送出，確認：
- 空清單不送（先清空 cart 測）。
- 必填欄位空 → 瀏覽器原生驗證擋下。
- 有填 → 發出 POST 到 `api.web3forms.com`（key 未設會回失敗 → 顯示 LINE 備援，符合預期）。
- CSP 不擋該請求（Console 無 CSP 錯誤）。

- [ ] **Step 3: Commit**

```bash
git add order.js
git commit -m "feat: submit order via Web3Forms with success/error screens"
```

---

### Task 9: style.css — 訂購相關樣式

**Files:**
- Modify: `style.css`（沿用既有變數，append 到檔末）

- [ ] **Step 1: 加樣式**（用既有 `--ease` 等變數；class 對齊前述 HTML）

```css
/* ===== CART BADGE ===== */
.cart-link { position: relative; display: inline-flex; align-items: center; margin-left: 1rem; color: inherit; }
.cart-badge {
  position: absolute; top: -6px; right: -8px; min-width: 18px; height: 18px;
  padding: 0 5px; border-radius: 9px; background: #c08a8a; color: #fff;
  font-size: .68rem; line-height: 18px; text-align: center;
}

/* ===== MODAL ORDER ===== */
.modal-order { display: flex; flex-wrap: wrap; align-items: center; gap: .6rem; margin: 1rem 0; }
.modal-size-select, .modal-size-custom { padding: .45rem .6rem; border: 1px solid #d9cfcf; border-radius: 4px; font: inherit; }
.modal-qty { display: inline-flex; align-items: center; border: 1px solid #d9cfcf; border-radius: 4px; }
.modal-qty button { width: 30px; height: 32px; border: none; background: none; font-size: 1.1rem; cursor: pointer; }
.modal-qty span { min-width: 24px; text-align: center; }
.modal-added { color: #8a9a8a; font-size: .9rem; }

/* ===== ORDER PAGE ===== */
.order-page { padding: 120px 0 80px; min-height: 60vh; }
.cart-empty { text-align: center; padding: 3rem 0; }
.cart-empty .btn-primary { margin-top: 1.2rem; }
.cart-list { margin: 1.5rem 0; }
.cart-row { display: flex; align-items: center; gap: 1rem; padding: 1rem 0; border-bottom: 1px solid #eee2e2; }
.cart-row-info { flex: 1; display: flex; flex-direction: column; gap: .2rem; }
.cart-row-name { font-weight: 500; }
.cart-row-size, .cart-row-price { font-size: .85rem; color: #8a7f7f; }
.cart-row-qty { display: inline-flex; align-items: center; border: 1px solid #d9cfcf; border-radius: 4px; }
.cart-row-qty button { width: 30px; height: 32px; border: none; background: none; font-size: 1.1rem; cursor: pointer; }
.cart-row-qty .qval { min-width: 26px; text-align: center; }
.cart-row-del { border: none; background: none; font-size: 1.3rem; color: #b99; cursor: pointer; padding: 0 .4rem; }
.cart-total { display: flex; justify-content: space-between; align-items: baseline; padding: 1.2rem 0; font-size: 1.1rem; }
.cart-total-amt { font-weight: 500; }

.order-form { display: flex; flex-direction: column; gap: 1rem; max-width: 520px; margin: 2rem auto 0; }
.order-form h3 { margin-bottom: .5rem; }
.order-form label { display: flex; flex-direction: column; gap: .35rem; font-size: .9rem; }
.order-form input, .order-form textarea { padding: .6rem .7rem; border: 1px solid #d9cfcf; border-radius: 4px; font: inherit; }
.order-form textarea { min-height: 80px; resize: vertical; }
.order-form .btn-primary { margin-top: .8rem; }
.form-error { color: #c05a5a; font-size: .9rem; text-align: center; }

.order-success { max-width: 520px; margin: 2rem auto 0; text-align: center; }
.order-success .success-mark { font-size: 2rem; color: #c08a8a; }
.order-no { font-size: 1.3rem; letter-spacing: .05em; margin: .3rem 0 1.5rem; }
.bank-info { background: #f7f1f1; border-radius: 6px; padding: 1.2rem; margin: 1rem 0; text-align: left; }
.bank-detail { font-family: inherit; white-space: pre-wrap; margin-top: .6rem; line-height: 1.8; }
.success-note { font-size: .9rem; color: #8a7f7f; margin: 1rem 0; }
.order-success .btn-line { margin: .5rem auto; }
.back-home { display: inline-block; margin-top: 1rem; font-size: .9rem; color: #8a7f7f; }
```

- [ ] **Step 2: 瀏覽器驗證**

桌機 + 手機寬度（DevTools 響應式）檢查：modal 訂購列、order.html 清單列、表單、成功畫面排版正常不破。

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "style: add cart badge, modal order, and order page styles"
```

---

### Task 10: 全流程驗證 + CSP 確認

**Files:** 無（驗證用）

- [ ] **Step 1: 單元測試全綠**

Run: `node --test`
Expected: PASS（13 tests）

- [ ] **Step 2: 端到端手動走查**

1. 首頁加 3 件不同商品/尺寸（含一個自訂尺寸）。
2. badge 數量正確、重整保留。
3. 進 order.html，清單 3 列正確、合計對。
4. 改數量、刪一列、合計即時更新。
5. 填表，必填驗證有效。
6. 送出（key 未設 → 預期失敗顯示 LINE 備援；或填入真 key → 成功畫面 + 編號 + 清空 cart + badge 歸零）。
7. Console 全程無 CSP / JS 錯誤。
8. 中/EN 切換在兩頁皆正常。

- [ ] **Step 3: 確認待補項清單**（回報使用者，不阻擋 commit）

- `order.js` `WEB3FORMS_KEY` 待填。
- `order.html` `#bankInfo` 銀行帳號待填。
- 缺的商品圖（使用者後補）。

- [ ] **Step 4: 收尾 commit（若驗證中有微調）**

```bash
git add -A
git commit -m "test: verify order flow end-to-end"
```

---

## 待使用者提供（實作中以佔位待填）

| 項目 | 位置 | 預設佔位 |
|------|------|----------|
| Web3Forms access key | `order.js` `WEB3FORMS_KEY` | ✅ 已填 `4145687f-468f-489d-ab01-6e1d95d5f5b9` |
| 銀行帳號資訊 | `order.html` `#bankInfo` | `【銀行】___` 等底線 |
| 缺的商品/lookbook 圖 | `images/` | （JS 已自動隱藏壞圖） |
