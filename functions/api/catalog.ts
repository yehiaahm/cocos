import type { Fn } from '../../server/env';
import { handle, json } from '../../server/http';
import { loadOverrides } from '../../server/catalog';
import { getSettings } from '../../server/orders';

/** GET /api/catalog — live prices, hidden and sold-out products, and payment details for checkout. */
export const onRequestGet: Fn = handle(async ({ env }) => {
  const [overrides, payment] = await Promise.all([loadOverrides(env.DB), getSettings(env.DB)]);
  // Short edge cache: price changes show up within a minute.
  return json({ overrides, payment }, { cache: 'public, max-age=30, s-maxage=30, stale-while-revalidate=120' });
});
