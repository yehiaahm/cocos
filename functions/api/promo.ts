import type { Fn } from '../../server/env';
import { assertNotLocked, assertSameOrigin, handle, ipHash, json, readJson, recordFailure } from '../../server/http';
import { PROMO_FAIL_LIMIT, PROMO_FAIL_WINDOW, assertUsable, findPromoByCode, toPublicPromo } from '../../server/promos';

/**
 * POST /api/promo { code } — checks a promo code at checkout and returns its rules, so the page can show the
 * discount live as the cart changes. Nothing is reserved here; POST /api/orders checks everything again.
 * Wrong codes count against the visitor (10 per 15 minutes) so codes can't be found by guessing.
 */
export const onRequestPost: Fn = handle(async ({ request, env }) => {
  assertSameOrigin(request);
  const failBucket = `promofail:${await ipHash(request, env.SESSION_SECRET ?? 'cocos')}`;
  await assertNotLocked(env.DB, failBucket, PROMO_FAIL_LIMIT, PROMO_FAIL_WINDOW);
  const body = await readJson<{ code?: unknown }>(request, 2_000);
  const promo = await findPromoByCode(env.DB, body.code);
  if (!promo) await recordFailure(env.DB, failBucket);
  assertUsable(promo);
  return json({ promo: toPublicPromo(promo) });
});
