import type { Fn } from '../../../server/env';
import { HttpError, handle, intOrNull, json, readJson } from '../../../server/http';
import { getProduct, loadOverrides, overrideFor, products } from '../../../server/catalog';
import type { AdminProduct } from '../../../src/lib/api-types';

/** GET /api/admin/products — catalog merged with dashboard overrides and units sold. */
export const onRequestGet: Fn = handle(async ({ env }) => {
  const [overrides, sold] = await Promise.all([
    loadOverrides(env.DB),
    env.DB.prepare(
      `SELECT i.product_id, SUM(i.qty) AS n FROM order_items i JOIN orders o ON o.id = i.order_id
       WHERE o.status != 'cancelled' GROUP BY i.product_id`,
    ).all<{ product_id: string; n: number }>(),
  ]);
  const soldBy = new Map(sold.results.map((r) => [r.product_id, r.n]));
  const list: AdminProduct[] = products.map((p) => {
    const o = overrideFor(overrides, p.id);
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      category: p.category,
      categoryName: p.categoryName,
      image: p.image,
      variants: p.variants.length,
      tags: p.tags,
      price: o.price,
      hidden: o.hidden,
      soldOut: o.soldOut,
      sold: soldBy.get(p.id) ?? 0,
    };
  });
  return json({ products: list });
});

/** PUT /api/admin/products { updates: [{ id, price, hidden, soldOut }] } — bulk save. */
export const onRequestPut: Fn = handle(async ({ request, env }) => {
  const { updates } = await readJson<{ updates: { id: string; price: number | null; hidden: boolean; soldOut: boolean }[] }>(request, 200_000);
  if (!Array.isArray(updates) || updates.length > 500) throw new HttpError(400, 'تحديثات غير صالحة');
  const stmts = updates.map((u) => {
    if (!getProduct(String(u.id))) throw new HttpError(400, `منتج غير معروف: ${u.id}`);
    return env.DB.prepare(
      `INSERT INTO product_overrides (product_id, price, hidden, sold_out, updated_at)
       VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(product_id) DO UPDATE SET price = excluded.price, hidden = excluded.hidden,
         sold_out = excluded.sold_out, updated_at = excluded.updated_at`,
    ).bind(u.id, intOrNull(u.price, { max: 1_000_000 }), u.hidden ? 1 : 0, u.soldOut ? 1 : 0);
  });
  if (stmts.length) await env.DB.batch(stmts);
  return json({ ok: true, saved: stmts.length });
});
