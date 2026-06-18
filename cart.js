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

  function makeOrderNo(date = new Date()) {
    const p = n => String(n).padStart(2, '0');
    const d = `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}`;
    const rnd = Math.random().toString(36).slice(2, 5).toUpperCase().padEnd(3, 'X');
    return `OR-${d}-${rnd}`;
  }

  function computePricing(items, opts = {}) {
    const discountThreshold = opts.discountThreshold ?? 2;
    const discountRate = opts.discountRate ?? 0.9;
    const bundles = opts.bundles || [];

    const subtotal = items.reduce((n, it) => n + it.price * it.qty, 0);
    const itemCount = items.reduce((n, it) => n + it.qty, 0);

    // 找出最省的可命中 bundle
    const has = id => items.find(it => it.id === id && it.qty >= 1);
    let best = null;
    for (const b of bundles) {
      if (b.productIds.every(has)) {
        const orig = b.productIds.reduce(
          (n, id) => n + items.find(it => it.id === id).price, 0);
        const saving = orig - b.flatPrice;
        if (saving > 0 && (!best || saving > best.saving)) best = { b, saving };
      }
    }

    let total;
    let freeShipping;
    if (best) {
      // bundle 各取 1 單位 → flatPrice；其餘單位與其他商品走全域規則
      const used = new Set(best.b.productIds);
      const rest = items
        .map(it => used.has(it.id) ? { ...it, qty: it.qty - 1 } : it)
        .filter(it => it.qty > 0);
      const restSub = rest.reduce((n, it) => n + it.price * it.qty, 0);
      const restCount = rest.reduce((n, it) => n + it.qty, 0);
      const restTotal = restCount >= discountThreshold
        ? Math.round(restSub * discountRate) : restSub;
      total = best.b.flatPrice + restTotal;
      freeShipping = true;
    } else if (itemCount >= discountThreshold) {
      total = Math.round(subtotal * discountRate);
      freeShipping = true;
    } else {
      total = subtotal;
      freeShipping = false;
    }

    const deposit = Math.round(total / 2);
    return {
      subtotal, discount: subtotal - total, total,
      deposit, cod: total - deposit, freeShipping, itemCount,
    };
  }

  if (typeof window !== 'undefined') {
    global.Cart = createCart(window.localStorage);
    global.createCart = createCart;
    global.makeOrderNo = makeOrderNo;
    global.computePricing = computePricing;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createCart, makeOrderNo, computePricing };
  }
})(typeof window !== 'undefined' ? window : globalThis);
