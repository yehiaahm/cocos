import type { Fn } from '../../../../server/env';
import { HttpError, handle, json, readJson, str } from '../../../../server/http';
import { deleteCategory, updateCategory, type CategoryInput } from '../../../../server/catalogAdmin';

const slugOf = (params: Record<string, string | string[]>) => {
  const raw = params.slug;
  const slug = Array.isArray(raw) ? raw[0] : raw;
  if (!slug || !/^[a-z0-9-]{1,60}$/.test(slug)) throw new HttpError(404, 'Category not found.', 'not_found');
  return slug;
};

/** PATCH /api/admin/categories/:slug { name, nameAr, description } — the web address (slug) never changes. */
export const onRequestPatch: Fn<'slug'> = handle(async ({ request, env, params }) => {
  const category = await updateCategory(env.DB, slugOf(params), await readJson<CategoryInput>(request));
  return json({ ok: true, category });
});

/** DELETE /api/admin/categories/:slug?moveTo=<slug> — products still inside are moved to `moveTo` (required if there are any). */
export const onRequestDelete: Fn<'slug'> = handle(async ({ request, env, params }) => {
  const moveTo = str(new URL(request.url).searchParams.get('moveTo'), 60) || undefined;
  const { moved } = await deleteCategory(env.DB, slugOf(params), moveTo);
  return json({ ok: true, moved });
});
