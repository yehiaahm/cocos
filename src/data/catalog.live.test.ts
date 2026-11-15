import { describe, expect, it } from 'vitest';
import { catalogIsLive, categories, getCategory, getProductById, getProductBySlug, isCategorySlug, markCatalogLive, products, setCatalog } from './catalog';

describe('live catalogue', () => {
  it('swaps in the dashboard catalogue and exposes new products and categories', () => {
    expect(getProductBySlug('grey-concrete-planter')).toBeUndefined();
    expect(isCategorySlug('gift-boxes')).toBe(false);
    setCatalog({
      categories: [{ slug: 'gift-boxes', name: 'Gift Boxes', nameAr: 'علب هدايا', description: 'Boxed sets.' }],
      products: [
        {
          id: 'coco-111',
          slug: 'grey-concrete-planter',
          name: 'Grey Concrete Planter',
          category: 'gift-boxes',
          description: 'A planter.',
          image: '/media/catalog/abc.jpg',
          tags: ['personalised', 'sale'],
          variants: [{ catalogId: 'coco-111', name: 'Grey', material: 'Concrete', images: ['/media/catalog/abc.jpg'] }],
        },
      ],
    });
    const p = getProductBySlug('grey-concrete-planter')!;
    expect(p.categoryName).toBe('Gift Boxes');
    expect(p.tags).toEqual(['personalised']); // unknown occasion dropped
    expect(p.priceStatus).toBe('pending');
    expect(getProductById('coco-111')).toBe(p);
    expect(products).toHaveLength(1);
    expect(categories).toHaveLength(1);
    expect(getCategory('gift-boxes')).toMatchObject({ name: 'Gift Boxes', nameAr: 'علب هدايا', count: 1 });
    expect(isCategorySlug('gift-boxes')).toBe(true);
    expect(getProductBySlug('green-gold-domino-set')).toBeUndefined();
    expect(catalogIsLive).toBe(false);
    markCatalogLive();
    expect(catalogIsLive).toBe(true);
  });
});
