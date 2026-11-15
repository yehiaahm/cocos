import type { Fn } from '../../../../server/env';
import { HttpError, handle, json, readJson } from '../../../../server/http';
import { loadCatalog, loadOverrides, overrideFor } from '../../../../server/catalog';
import { adminProductView, deleteProduct, updateProduct, type ProductInput } from '../../../../server/catalogAdmin';

const idOf = (params: Record<string, string | string[]>) => {
  const raw = params.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || !/^[a-z0-9-]{1,20}$/i.test(id)) throw new HttpError(404, 'Product not found.', 'not_found');
  return id;
};

/** GET /api/admin/products/:id — one product with all its variants and photos. */
export const onRequestGet: Fn<'id'> = handle(async ({ env, params }) => {
  const id = idOf(params);
  const catalog = await loadCatalog(env.DB);
  const p = catalog.byId.get(id);
  if (!p) throw new HttpError(404, 'Product not found.', 'not_found');
  const category = catalog.categories.find((c) => c.slug === p.category);
  return json({ product: adminProductView(p, category?.name ?? p.category, overrideFor(await loadOverrides(env.DB), id), 0) });
});

/** PATCH /api/admin/products/:id — save the whole product (fields not sent keep their value only for price / hidden / soldOut). */
export const onRequestPatch: Fn<'id'> = handle(async ({ request, env, params }) => {
  const product = await updateProduct(env.DB, idOf(params), await readJson<ProductInput>(request, 100_000));
  return json({ ok: true, id: product.id, slug: product.slug });
});

/** DELETE /api/admin/products/:id — remove it from the shop (past orders keep their own copy of the details). */
export const onRequestDelete: Fn<'id'> = handle(async ({ env, params }) => {
  await deleteProduct(env.DB, idOf(params));
  return json({ ok: true });
});
