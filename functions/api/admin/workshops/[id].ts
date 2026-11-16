import type { Fn } from '../../../../server/env';
import { HttpError, handle, json, readJson } from '../../../../server/http';
import { deleteWorkshop, getWorkshop, inputFromWorkshop, parseWorkshopInput, updateWorkshop } from '../../../../server/workshops';
import type { AdminWorkshopInput } from '../../../../src/lib/api-types';

const idOf = (p: string | string[]) => {
  const id = Array.isArray(p) ? p[0] : p;
  if (!id || !/^[a-z0-9-]{1,60}$/.test(id)) throw new HttpError(404, 'Workshop not found.', 'not_found');
  return id;
};

/** GET /api/admin/workshops/:id */
export const onRequestGet: Fn<'id'> = handle(async ({ env, params }) => {
  const workshop = await getWorkshop(env.DB, idOf(params.id));
  if (!workshop) throw new HttpError(404, 'Workshop not found.', 'not_found');
  return json({ workshop });
});

/** PATCH /api/admin/workshops/:id — any subset of the fields (e.g. just { active: false } to hide it from the shop). */
export const onRequestPatch: Fn<'id'> = handle(async ({ request, env, params }) => {
  const id = idOf(params.id);
  const current = await getWorkshop(env.DB, id);
  if (!current) throw new HttpError(404, 'Workshop not found.', 'not_found');
  const body = await readJson<Partial<AdminWorkshopInput>>(request, 8_000);
  await updateWorkshop(env.DB, id, parseWorkshopInput({ ...inputFromWorkshop(current), ...body }));
  return json({ workshop: await getWorkshop(env.DB, id) });
});

/** DELETE /api/admin/workshops/:id — the workshop disappears from the shop at once. */
export const onRequestDelete: Fn<'id'> = handle(async ({ env, params }) => {
  await deleteWorkshop(env.DB, idOf(params.id));
  return json({ ok: true });
});
