import { describe, expect, it } from 'vitest';
import { computeTotals } from './orders';
import { products, getProduct } from './catalog';

describe('order totals', () => {
  it('needs every line priced before there is a subtotal', () => {
    expect(computeTotals([{ qty: 2, unitPrice: 100 }, { qty: 1, unitPrice: null }], 50)).toEqual({ subtotal: null, total: null });
  });
  it('needs a delivery fee before there is a total', () => {
    expect(computeTotals([{ qty: 2, unitPrice: 100 }], null)).toEqual({ subtotal: 200, total: null });
  });
  it('adds lines and delivery', () => {
    expect(computeTotals([{ qty: 2, unitPrice: 450 }, { qty: 1, unitPrice: 300 }], 60)).toEqual({ subtotal: 1200, total: 1260 });
  });
});

describe('server catalog', () => {
  it('matches the storefront: 80 products, held-back items excluded', () => {
    expect(products).toHaveLength(80);
    expect(getProduct('coco-021')).toBeUndefined();
    expect(getProduct('coco-052')?.variants.length).toBe(6);
  });
});
