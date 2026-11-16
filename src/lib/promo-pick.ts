/**
 * The promo code a shopper picked from the top bar ("Copy code"), remembered on this device so checkout can
 * apply it for them. Storage can be blocked (private mode): then it simply isn't remembered.
 */
const KEY = 'coco-promo-code';
const DISMISSED_KEY = 'coco-promo-dismissed';

export function rememberPromoCode(code: string): void {
  try {
    localStorage.setItem(KEY, code);
  } catch {
    /* storage unavailable */
  }
}

export function pickedPromoCode(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function forgetPromoCode(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

/** The bar stays closed for the code the shopper dismissed; a new offer shows again. */
export function isPromoDismissed(code: string): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === code;
  } catch {
    return false;
  }
}

export function dismissPromo(code: string): void {
  try {
    localStorage.setItem(DISMISSED_KEY, code);
  } catch {
    /* storage unavailable */
  }
}

/** "2d 04h" · "04:12:09" — time left until `endsAt`, or null when it has passed. */
export function timeLeft(endsAt: string, now = Date.now()): { label: string; ms: number } | null {
  const ms = new Date(endsAt).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return { label: d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}:${pad(m)}:${pad(sec)}`, ms };
}
