import { beforeEach, describe, expect, it } from 'vitest';
import { lineKey, sanitiseLines, selectCount, useCart } from './cart';
import { normaliseEgyptPhone } from '../lib/phone';

describe('cart store', () => {
  beforeEach(() => useCart.setState({ lines: [] }));

  it('keys lines by product + variant and merges repeats', () => {
    const { add } = useCart.getState();
    add({ productId: 'coco-052', variantId: 'coco-076' });
    add({ productId: 'coco-052', variantId: 'coco-076', qty: 2 });
    add({ productId: 'coco-052', variantId: 'coco-052' });
    const s = useCart.getState();
    expect(s.lines).toHaveLength(2);
    expect(selectCount(s)).toBe(4);
    expect(s.lines[0].key).toBe(lineKey('coco-052', 'coco-076'));
  });

  it('keeps different personalisations on separate lines', () => {
    const { add } = useCart.getState();
    add({ productId: 'coco-056', variantId: 'coco-056', personalisation: 'Nour' });
    add({ productId: 'coco-056', variantId: 'coco-056', personalisation: 'Ali' });
    expect(useCart.getState().lines).toHaveLength(2);
  });

  it('setQty to 0 removes the line; remove and clear work', () => {
    const { add } = useCart.getState();
    add({ productId: 'coco-010', variantId: 'coco-010' });
    add({ productId: 'coco-062', variantId: 'coco-062' });
    const [a] = useCart.getState().lines;
    useCart.getState().setQty(a.key, 0);
    expect(useCart.getState().lines).toHaveLength(1);
    useCart.getState().clear();
    expect(useCart.getState().lines).toHaveLength(0);
  });

  it('drops malformed or hidden items from storage', () => {
    expect(
      sanitiseLines([
        { productId: 'coco-010', variantId: 'coco-010', qty: 2 },
        { productId: 'coco-021', variantId: 'coco-021', qty: 1 }, // held back
        { productId: 'nope', variantId: 'x' },
        'junk',
      ]),
    ).toEqual([{ key: 'coco-010|coco-010', productId: 'coco-010', variantId: 'coco-010', qty: 2 }]);
    expect(sanitiseLines({ 'coco-010': { qty: 1 } })).toEqual([]);
  });
});

describe('Egyptian phone numbers', () => {
  it.each([
    ['010 1234 5678', '01012345678'],
    ['+20 100 123 4567', '01001234567'],
    ['0020-115-123-4567', '01151234567'],
    ['01212345678', '01212345678'],
  ])('%s → %s', (input, out) => expect(normaliseEgyptPhone(input)).toBe(out));

  it.each(['12345', '0131234567', '01312345678', '+1 555 123 4567'])('rejects %s', (input) => expect(normaliseEgyptPhone(input)).toBeNull());
});
