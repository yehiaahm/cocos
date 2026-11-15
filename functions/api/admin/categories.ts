import type { Fn } from '../../../server/env';
import { handle, json, readJson } from '../../../server/http';
import { OCCASIONS, loadCatalog } from '../../../server/catalog';
import { createCategory, reorderCategories, type CategoryInput } from '../../../server/catalogAdmin';
import type { AdminCategory } from '../../../src/lib/api-types';

/** GET /api/admin/categories — every category with how many products it holds. */
export const onRequestGet: Fn = handle(async ({ env }) => {
  const catalog = await loadCatalog(env.DB);
  const counts = new Map<string, number>();
  for (const p of catalog.products) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  const categories: AdminCategory[] = catalog.categories.map((c) => ({ ...c, count: counts.get(c.slug) ?? 0 }));
  return json({ categories, occasions: OCCASIONS });
});

/** POST /api/admin/categories { name, nameAr, description, slug? } — add a category. */
export const onRequestPost: Fn = handle(async ({ request, env }) => {
  const category = await createCategory(env.DB, await readJson<CategoryInput>(request));
  return json({ ok: true, category }, { status: 201 });
});

/** PUT /api/admin/categories { order: [slug, …] } — save the display order. */
export const onRequestPut: Fn = handle(async ({ request, env }) => {
  const { order } = await readJson<{ order: unknown }>(request);
  await reorderCategories(env.DB, order);
  return json({ ok: true });
});
