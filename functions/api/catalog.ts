import type { Fn } from '../../server/env';
import { handle, json } from '../../server/http';
import { loadCatalog, loadOverrides, publicOverrides } from '../../server/catalog';
import { getSettings } from '../../server/orders';
import { bannerPromo } from '../../server/promos';
import { loadPublicWorkshops } from '../../server/workshops';

/**
 * GET /api/catalog — live prices, hidden and sold-out products (a tracked stock of 0 counts as sold out), payment details for checkout,
 * the offer for the top bar, and — once the
 * dashboard has changed anything in the catalogue (rev > 0) — the whole catalogue. While rev is 0 the catalogue is
 * exactly the one built into the site, so it is not sent again.
 */
export const onRequestGet: Fn = handle(async ({ env }) => {
  const [catalog, overrides, payment, promo, ws] = await Promise.all([
    loadCatalog(env.DB),
    loadOverrides(env.DB),
    getSettings(env.DB),
    bannerPromo(env.DB),
    loadPublicWorkshops(env.DB),
  ]);
  // `promo`: the offer announced in the bar at the top of every page (null when there is none).
  const body: Record<string, unknown> = { overrides: publicOverrides(overrides), payment, promo, rev: catalog.rev };
  if (catalog.rev > 0) body.catalog = { categories: catalog.categories, products: catalog.products };
  // Workshops: sent (possibly an empty list) once the dashboard has changed them; until then the built-in list is exact.
  if (ws.workshops) body.workshops = ws.workshops;
  // Short edge cache: price and catalogue changes show up within a minute.
  return json(body, { cache: 'public, max-age=30, s-maxage=30, stale-while-revalidate=120' });
});
