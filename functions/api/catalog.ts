import type { Fn } from '../../server/env';
import { handle, json } from '../../server/http';
import { loadCatalog, loadOverrides } from '../../server/catalog';
import { getSettings } from '../../server/orders';

/**
 * GET /api/catalog — live prices, hidden and sold-out products, payment details for checkout, and — once the
 * dashboard has changed anything in the catalogue (rev > 0) — the whole catalogue. While rev is 0 the catalogue is
 * exactly the one built into the site, so it is not sent again.
 */
export const onRequestGet: Fn = handle(async ({ env }) => {
  const [catalog, overrides, payment] = await Promise.all([loadCatalog(env.DB), loadOverrides(env.DB), getSettings(env.DB)]);
  const body: Record<string, unknown> = { overrides, payment, rev: catalog.rev };
  if (catalog.rev > 0) body.catalog = { categories: catalog.categories, products: catalog.products };
  // Short edge cache: price and catalogue changes show up within a minute.
  return json(body, { cache: 'public, max-age=30, s-maxage=30, stale-while-revalidate=120' });
});
