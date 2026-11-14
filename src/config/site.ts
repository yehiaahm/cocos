/**
 * Every business detail the owner may need to change lives in this file.
 *
 * TODO (owner): fill in `whatsappNumber` and `facebookUrl` (HANDOFF §12.2).
 * Until then, WhatsApp buttons fall back to Instagram and the Facebook
 * button is hidden, so no link on the site is ever dead.
 */
export const site = {
  name: "Coco's Resin Art",
  shortName: 'Coco’s Resin Art',
  tagline: 'Handmade home decor, poured by hand in Egypt',
  description:
    "Handmade resin, wood & decoupage, macramé and candle pieces, plus heirloom resin board games — made in small batches in Egypt by Coco's Resin Art. Personalised gifts and creative workshops.",
  locale: 'en_EG',
  country: 'Egypt',
  currency: 'EGP' as const,

  /**
   * Production URL (no trailing slash) — used for canonical links, Open Graph and sitemap.xml.
   * TODO (owner): replace with the real domain. A VITE_SITE_URL build variable overrides it.
   */
  url: (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/+$/, '') || 'https://www.example.com',

  /** WhatsApp number in international format, digits only, e.g. "201001234567". */
  whatsappNumber: '201005199355',
  instagramHandle: 'coco_resin_art',
  instagramUrl: 'https://www.instagram.com/coco_resin_art?srtk=eXk5dW03cG84dnY3&utm_source=qr',
  /** Full Facebook page URL, e.g. "https://www.facebook.com/cocosart". */
  facebookUrl: 'https://www.facebook.com/share/18JoSzFYdK/?mibextid=wwXIfr',

  /** Social preview image (1200×630), relative to the site root. */
  ogImage: '/og-image.jpg',
} as const;

export const hasWhatsApp = site.whatsappNumber.replace(/\D/g, '').length >= 10;

/** WhatsApp chat link with a prefilled message, or Instagram while no number is configured. */
export function contactLink(message: string): { href: string; channel: 'whatsapp' | 'instagram' } {
  if (hasWhatsApp) {
    const n = site.whatsappNumber.replace(/\D/g, '');
    return { href: `https://wa.me/${n}?text=${encodeURIComponent(message)}`, channel: 'whatsapp' };
  }
  return { href: site.instagramUrl, channel: 'instagram' };
}

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${site.url}${path.startsWith('/') ? '' : '/'}${path}`;
}
