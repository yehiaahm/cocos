/**
 * Trusted client IP for the Node server.
 *
 * Behind Railway's proxy the only trustworthy part of X-Forwarded-For is what the proxy itself
 * appended (the right-most entries); everything to the left is whatever the client chose to send.
 * `hops` is how many proxies sit in front of this server (default 1 = Railway's edge only; set
 * TRUSTED_PROXY_HOPS if that ever changes). With no proxy header at all we fall back to the socket address.
 */
export function trustedClientIp(forwardedFor: string | string[] | undefined, socketAddress: string | undefined, hops = 1): string {
  const raw = Array.isArray(forwardedFor) ? forwardedFor.join(',') : (forwardedFor ?? '');
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const n = Math.max(1, Math.floor(hops) || 1);
  const pick = parts.length >= n ? parts[parts.length - n] : undefined;
  return (pick ?? socketAddress ?? 'local').slice(0, 64);
}

/** Header the Node server sets itself (after deleting any client-supplied copy). ipHash() reads it. */
export const CLIENT_IP_HEADER = 'x-client-ip';
