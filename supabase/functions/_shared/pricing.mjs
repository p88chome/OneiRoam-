export function computePricing(items, opts = {}) {
  const discountThreshold = opts.discountThreshold ?? 2;
  const discountRate = opts.discountRate ?? 0.9;
  const bundles = opts.bundles || [];
  const subtotal = items.reduce((n, it) => n + it.price * it.qty, 0);
  const itemCount = items.reduce((n, it) => n + it.qty, 0);
  const has = id => items.find(it => it.id === id && it.qty >= 1);
  let best = null;
  for (const b of bundles) {
    if (b.productIds.every(has)) {
      const orig = b.productIds.reduce((n, id) => n + items.find(it => it.id === id).price, 0);
      const saving = orig - b.flatPrice;
      if (saving > 0 && (!best || saving > best.saving)) best = { b, saving };
    }
  }
  let total, freeShipping;
  if (best) {
    const used = new Set(best.b.productIds);
    const rest = items.map(it => used.has(it.id) ? { ...it, qty: it.qty - 1 } : it).filter(it => it.qty > 0);
    const restSub = rest.reduce((n, it) => n + it.price * it.qty, 0);
    const restCount = rest.reduce((n, it) => n + it.qty, 0);
    const restTotal = restCount >= discountThreshold ? Math.round(restSub * discountRate) : restSub;
    total = best.b.flatPrice + restTotal; freeShipping = true;
  } else if (itemCount >= discountThreshold) {
    total = Math.round(subtotal * discountRate); freeShipping = true;
  } else {
    total = subtotal; freeShipping = false;
  }
  const deposit = Math.round(total / 2);
  return { subtotal, discount: subtotal - total, total, deposit, cod: total - deposit, freeShipping, itemCount };
}
