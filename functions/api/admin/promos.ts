import type { Fn } from '../../../server/env';
import { handle, json, readJson } from '../../../server/http';
import { createPromo, getAdminPromo, listPromos, parsePromoInput } from '../../../server/promos';
import type { AdminPromoInput } from '../../../src/lib/api-types';

/** GET /api/admin/promos — every promo code with its usage and results (orders, discount given, revenue). */
export const onRequestGet: Fn = handle(async ({ env }) => json({ promos: await listPromos(env.DB) }));

/** POST /api/admin/promos — create a code. */
export const onRequestPost: Fn = handle(async ({ request, env }) => {
  const values = parsePromoInput(await readJson<Partial<AdminPromoInput>>(request, 8_000));
  const id = await createPromo(env.DB, values);
  return json({ promo: await getAdminPromo(env.DB, id) }, { status: 201 });
});
