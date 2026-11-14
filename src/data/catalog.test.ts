import { describe, expect, it } from 'vitest';
import { HIDDEN_IDS, categories, defaultVariant, filterProducts, products, baseFilter } from './catalog';
import { formatPrice } from '../lib/format';
import { imageSources } from '../lib/images';

describe('catalog', () => {
  it('shows exactly the 80 approved products and none of the held-back items', () => {
    expect(products).toHaveLength(80);
    for (const p of products) {
      expect(HIDDEN_IDS.has(p.id)).toBe(false);
      expect(p.variants.some((v) => HIDDEN_IDS.has(v.catalogId))).toBe(false);
    }
  });

  it('has unique ids and slugs', () => {
    expect(new Set(products.map((p) => p.id)).size).toBe(products.length);
    expect(new Set(products.map((p) => p.slug)).size).toBe(products.length);
  });

  it('category counts match the data', () => {
    expect(Object.fromEntries(categories.map((c) => [c.slug, c.count]))).toEqual({
      gaming: 12,
      resin: 28,
      'wood-decoupage': 25,
      macrame: 6,
      candles: 9,
      concrete: 0,
    });
  });

  it('every photo referenced by the catalog has optimised versions', () => {
    for (const p of products) {
      for (const img of [p.image, ...p.variants.flatMap((v) => v.images)]) {
        expect(imageSources(img).srcSet, img).toBeTruthy();
      }
    }
  });

  it('default variant matches the card image', () => {
    for (const p of products) expect(defaultVariant(p)).toBeDefined();
  });
});

describe('filters', () => {
  it('search ignores accents and case and needs every word', () => {
    const r = filterProducts(products, { category: 'all', occasion: 'all', query: 'MACRAME mirror' });
    expect(r.map((p) => p.id)).toEqual(['coco-094']);
  });

  it('occasion + category combine, and counts respect occasion', () => {
    const base = baseFilter(products, { occasion: 'halloween', query: '' });
    expect(base.every((p) => p.tags.includes('halloween'))).toBe(true);
    const candles = filterProducts(products, { category: 'candles', occasion: 'halloween', query: '' });
    expect(candles.every((p) => p.category === 'candles')).toBe(true);
    expect(candles.length).toBeLessThanOrEqual(base.length);
  });
});

describe('price', () => {
  it('never invents a price', () => {
    expect(formatPrice(null)).toBe('Price pending');
    expect(formatPrice(undefined)).toBe('Price pending');
    expect(formatPrice(1250)).toBe('EGP 1,250');
  });
});
