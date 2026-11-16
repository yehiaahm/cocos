import type { PublicWorkshop } from './api-types';

/**
 * The workshops built into the site. They are the starting point only: the first time the dashboard opens the
 * workshops screen they are copied into the database (server/workshops.ts), and from then on the owner adds,
 * edits, reorders, hides and deletes them there. The prerendered homepage uses this list until the live one arrives.
 */
export const defaultWorkshops: PublicWorkshop[] = [
  {
    id: 'resin',
    name: 'Resin art',
    nameAr: 'ريزن آرت',
    tag: 'Most popular',
    image: '/images/products/a3465002.jpg',
    alt: 'Blue floral resin coasters',
    description: 'Mix pigments, play with cells and lacing, and seal in gold leaf. You leave with your own ocean coasters or tray.',
    day1: 'Colour theory, safe mixing and your first pour',
    day2: 'Demould, sand and polish to a glass finish',
    price: null,
    dates: '',
  },
  {
    id: 'candles',
    name: 'Candle making',
    nameAr: 'صناعة الشموع',
    tag: 'Cosy & calm',
    image: '/images/legacy-crops/workshop.jpg',
    alt: 'Guests making candles around a long table',
    description: 'Choose wax, wick and fragrance, then pour candles in jars and moulds — dried flowers and all.',
    day1: 'Wax types, scent blending and the pour',
    day2: 'Trim, label and decorate your candles',
    price: null,
    dates: '',
  },
  {
    id: 'decoupage',
    name: 'Decoupage',
    nameAr: 'ديكوباج',
    tag: 'Beginner friendly',
    image: '/images/products/d91959e3.jpg',
    alt: 'Old Cairo decoupage tray',
    description: 'Turn plain wooden boxes and trays into patterned keepsakes with papers, paints and varnish.',
    day1: 'Prep the surface and lay your design',
    day2: 'Seal, distress and varnish the final piece',
    price: null,
    dates: '',
  },
  {
    id: 'concrete',
    name: 'Concrete art',
    nameAr: 'فن الكونكريت',
    tag: 'Modern decor',
    image: '/images/legacy-crops/pyramids.jpg',
    alt: 'Concrete pyramids made in class',
    description: 'Cast planters, trays and sculptural decor in concrete, then finish them with colour and gold.',
    day1: 'Mix, cast and set your moulds',
    day2: 'Demould, paint and finish your decor',
    price: null,
    dates: '',
  },
];

/** Photo used when a workshop has none of its own. */
export const FALLBACK_WORKSHOP_IMAGE = '/images/legacy-crops/workshop.jpg';
