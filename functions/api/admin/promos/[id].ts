import type { Fn } from '../../../../server/env';
import { HttpError, handle, json, readJson } from '../../../../server/http';
import { getAdminPromo, inputFromRow, parsePromoInput, updatePromo, type PromoRow } from '../../../../server/promos';
import type { AdminPromoInput } from '../../../../src/lib/api-types';

const idOf = (p: string | string[]) => {
  const n = Number(Array.isArray(p) ? p[0] : p);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(404, 'Not found', 'not_found');
  return n;
};
const rowOf = async (db: D1Database, id: number) => {
  const row = await db.prepare('SELECT * FROM promo_codes WHERE id = ?').bind(id).first<PromoRow>();
  if (!row) throw new HttpError(404, 'Not found', 'not_found');
  return row;
};

/** GET /api/admin/promos/:id */
export const onRequestGet: Fn<'id'> = handle(async ({ env, params }) => {
  const promo = await getAdminPromo(env.DB, idOf(params.id));
  if (!promo) throw new HttpError(404, 'Not found', 'not_found');
  return json({ promo });
});

/** PATCH /api/admin/promos/:id — any subset of the fields (e.g. just { active: false } to pause it). */
export const onRequestPatch: Fn<'id'> = handle(async ({ request, env, params }) => {
  const id = idOf(params.id);
  const row = await rowOf(env.DB, id);
  const body = await readJson<Partial<AdminPromoInput>>(request, 8_000);
  await updatePromo(env.DB, id, parsePromoInput({ ...inputFromRow(row), ...body }));
  return json({ promo: await getAdminPromo(env.DB, id) });
});

/**
 * DELETE /api/admin/promos/:id — the code stops working at once. Orders that used it keep their code and discount
 * (they hold their own copy of the rules).
 */
export const onRequestDelete: Fn<'id'> = handle(async ({ env, params }) => {
  const id = idOf(params.id);
  await rowOf(env.DB, id);
  await env.DB.prepare('DELETE FROM promo_codes WHERE id = ?').bind(id).run();
  return json({ ok: true });
});
