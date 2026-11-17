import type { Fn } from '../../../server/env';
import { HttpError, handle, intOrNull, json, readJson } from '../../../server/http';
import { loadCatalog, loadOverrides, overrideFor } from '../../../server/catalog';
import { adminProductView, createProduct, type ProductInput } from '../../../server/catalogAdmin';
import type { AdminProduct } from '../../../src/lib/api-types';
import { NOW_SQL } from '../../../server/sql';

/** GET /api/admin/products — the catalogue merged with dashboard overrides and units sold. */
export const onRequestGet: Fn = handle(async ({ env }) => {
  const [catalog, overrides, sold] = await Promise.all([
    loadCatalog(env.DB),
    loadOverrides(env.DB),
    env.DB.prepare(
      `SELECT i.product_id, SUM(i.qty) AS n FROM order_items i JOIN orders o ON o.id = i.order_id
       WHERE o.status != 'cancelled' GROUP BY i.product_id`,
    ).all<{ product_id: string; n: number }>(),
  ]);
  const soldBy = new Map(sold.results.map((r) => [r.product_id, r.n]));
  const names = new Map(catalog.categories.map((c) => [c.slug, c.name]));
  const list: AdminProduct[] = catalog.products.map((p) =>
    adminProductView(p, names.get(p.category) ?? p.category, overrideFor(overrides, p.id), soldBy.get(p.id) ?? 0),
  );
  return json({ products: list, categories: catalog.categories });
});

/** POST /api/admin/products — add a product (see server/catalogAdmin.ts for the accepted fields). */
export const onRequestPost: Fn = handle(async ({ request, env }) => {
  const body = await readJson<ProductInput>(request, 100_000);
  const product = await createProduct(env.DB, body);
  return json({ ok: true, id: product.id, slug: product.slug }, { status: 201 });
});

/** PUT /api/admin/products { updates: [{ id, price, hidden, soldOut, stock? }] } — bulk save of the quick-edit rows. */
export const onRequestPut: Fn = handle(async ({ request, env }) => {
  const { updates } = await readJson<{ updates: { id: string; price: number | null; hidden: boolean; soldOut: boolean; stock?: number | null }[] }>(request, 200_000);
  if (!Array.isArray(updates) || updates.length > 500) throw new HttpError(400, 'تحديثات غير صالحة');
  const catalog = await loadCatalog(env.DB);
  const stmts = updates.map((u) => {
    if (!catalog.byId.has(String(u.id))) throw new HttpError(400, `منتج غير معروف: ${u.id}`);
    return env.DB.prepare(
      `INSERT INTO product_overrides (product_id, price, hidden, sold_out, stock, updated_at)
       VALUES (?, ?, ?, ?, ?, ${NOW_SQL}) AS incoming
       ON DUPLICATE KEY UPDATE price = incoming.price, hidden = incoming.hidden,
         sold_out = incoming.sold_out, updated_at = incoming.updated_at,
         stock = CASE WHEN ? THEN incoming.stock ELSE product_overrides.stock END`,
    ).bind(u.id, intOrNull(u.price, { max: 1_000_000 }), u.hidden ? 1 : 0, u.soldOut ? 1 : 0, intOrNull(u.stock, { max: 1_000_000 }), u.stock !== undefined ? 1 : 0);
  });
  if (stmts.length) await env.DB.batch(stmts);
  return json({ ok: true, saved: stmts.length });
});
