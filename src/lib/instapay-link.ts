/** DOM-free so both the site and the API can use it. */
/**
 * The shop's InstaPay payment link (what the app's "share my link" gives, e.g. https://ipn.eg/S/name/instapay/AbC123).
 * Accepts the whole share text and pulls the link out. Only https://ipn.eg/… is accepted, so a typo or a
 * lookalike domain in settings can never send customers somewhere else.
 */
export function parseInstapayLink(input: string | undefined | null): string | null {
  const m = (input ?? '').match(/https:\/\/ipn\.eg\/[^\s"'<>]+/i);
  if (!m) return null;
  try {
    const u = new URL(m[0]);
    return u.protocol === 'https:' && u.hostname === 'ipn.eg' && u.username === '' && u.port === '' ? u.toString() : null;
  } catch {
    return null;
  }
}
