import type { Fn } from '../../../../server/env';
import { randomToken } from '../../../../server/http';
import { googleConfigured, googleRedirectUri, oauthCookie, pkceChallenge, safeNext } from '../../../../server/accounts';

/** GET /api/auth/google?next=/checkout — sends the browser to Google's sign-in page. */
export const onRequestGet: Fn = async ({ request, env }) => {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get('next'));
  if (!googleConfigured(env)) {
    return new Response(null, { status: 302, headers: { location: `/login?error=google_off&next=${encodeURIComponent(next)}` } });
  }
  const state = randomToken(18);
  const verifier = randomToken(48);
  const google = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  google.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(request),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();

  // state.verifier.next — HttpOnly, only sent back to /api/auth/google/*, expires in 10 minutes.
  const cookie = `${state}.${verifier}.${encodeURIComponent(next)}`;
  return new Response(null, {
    status: 302,
    headers: { location: google.toString(), 'set-cookie': oauthCookie(cookie, request), 'cache-control': 'no-store' },
  });
};
