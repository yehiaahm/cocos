import type { Fn } from '../../../../server/env';
import { HttpError } from '../../../../server/http';
import { readCookie } from '../../../../server/auth';
import {
  OAUTH_COOKIE,
  clearOauthCookie,
  createUserSession,
  exchangeGoogleCode,
  googleConfigured,
  safeNext,
  upsertGoogleUser,
  userCookie,
} from '../../../../server/accounts';

/** GET /api/auth/google/callback?code&state — Google sends the browser back here after sign-in. */
export const onRequestGet: Fn = async ({ request, env }) => {
  const url = new URL(request.url);
  // Cookie = state.verifier.next (readCookie already URL-decodes; `next` itself may contain dots).
  const [state, verifier, ...rest] = (readCookie(request, OAUTH_COOKIE) ?? '').split('.');
  const next = safeNext(rest.join('.') || null);

  const fail = (code: string) => {
    const headers = new Headers({ location: `/login?error=${code}&next=${encodeURIComponent(next)}`, 'cache-control': 'no-store' });
    headers.append('set-cookie', clearOauthCookie(request));
    return new Response(null, { status: 302, headers });
  };

  if (!googleConfigured(env)) return fail('google_off');
  if (url.searchParams.get('error')) return fail('google_cancelled');
  const code = url.searchParams.get('code');
  if (!code || !state || !verifier || url.searchParams.get('state') !== state) return fail('google_state');

  try {
    const profile = await exchangeGoogleCode(env, request, code, verifier);
    const user = await upsertGoogleUser(env, profile);
    const token = await createUserSession(env, user.id);
    const headers = new Headers({ location: next, 'cache-control': 'no-store' });
    headers.append('set-cookie', clearOauthCookie(request));
    headers.append('set-cookie', userCookie(token, request));
    return new Response(null, { status: 302, headers });
  } catch (e) {
    if (!(e instanceof HttpError)) console.error('[google] callback error', e);
    return fail(e instanceof HttpError && e.code === 'google_unverified' ? 'google_unverified' : 'google_failed');
  }
};
