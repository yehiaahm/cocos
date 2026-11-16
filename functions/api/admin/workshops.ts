import type { Fn } from '../../../server/env';
import { handle, json, readJson } from '../../../server/http';
import { createWorkshop, getWorkshop, listWorkshops, parseWorkshopInput, reorderWorkshops } from '../../../server/workshops';
import type { AdminWorkshopInput } from '../../../src/lib/api-types';

/** GET /api/admin/workshops — every workshop (hidden ones too), in display order. */
export const onRequestGet: Fn = handle(async ({ env }) => json({ workshops: await listWorkshops(env.DB) }));

/** POST /api/admin/workshops — add a workshop (it becomes the last tab). */
export const onRequestPost: Fn = handle(async ({ request, env }) => {
  const values = parseWorkshopInput(await readJson<Partial<AdminWorkshopInput>>(request, 8_000));
  const id = await createWorkshop(env.DB, values);
  return json({ workshop: await getWorkshop(env.DB, id) }, { status: 201 });
});

/** PUT /api/admin/workshops { order: [id, …] } — save the display order. */
export const onRequestPut: Fn = handle(async ({ request, env }) => {
  const { order } = await readJson<{ order: unknown }>(request, 8_000);
  await reorderWorkshops(env.DB, order);
  return json({ ok: true });
});
