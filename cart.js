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

  if (typeof window !== 'undefined') {
    global.Cart = createCart(window.localStorage);
    global.createCart = createCart;
    global.makeOrderNo = makeOrderNo;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createCart, makeOrderNo };
  }
})(typeof window !== 'undefined' ? window : globalThis);
