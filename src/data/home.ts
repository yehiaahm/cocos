import type { CategorySlug } from './catalog';

/** Homepage copy and imagery. Swap photos here when the owner supplies replacements (HANDOFF §12.4). */

export const categoryPanels: {
  slug: CategorySlug;
  name: string;
  ar: string;
  img: string;
  alt: string;
  desc: string;
  subs: string[];
}[] = [
  {
    slug: 'resin',
    name: 'Resin',
    ar: 'ريزن',
    img: '/images/products/2d4c7956.jpg',
    alt: 'Ocean resin dish rimmed with seashells',
    desc: 'Glossy, hand-poured pieces in ocean blues, marble and gold — coasters, dishes, clocks, notebooks and seasonal decor.',
    subs: ['Coasters', 'Trays & dishes', 'Wall clocks', 'Notebooks', 'Ashtrays', 'Ramadan decor', 'Phone cases', 'Bookmarks'],
  },
  {
    slug: 'gaming',
    name: 'Board Games',
    ar: 'ألعاب',
    img: '/images/products/f5fbe12d.jpg',
    alt: 'Five glitter resin tic-tac-toe boards',
    desc: 'Heirloom-weight game sets poured in resin — chess, domino, backgammon and XO in any colourway.',
    subs: ['Chess', 'Domino', 'Backgammon', 'XO'],
  },
  {
    slug: 'wood-decoupage',
    name: 'Wood & Decoupage',
    ar: 'خشب وديكوباج',
    img: '/images/products/d52de0c5.jpg',
    alt: 'Hexagonal wooden mosque lantern',
    desc: 'Lanterns, trays, crescents and keepsakes in wood — painted, stencilled and finished with decoupage.',
    subs: ['Ramadan lanterns', 'Trays', 'Crescents & stands', 'Coasters', 'Quran stands', 'Incense burners'],
  },
  {
    slug: 'macrame',
    name: 'Macramé',
    ar: 'مكرمية',
    img: '/images/products/aec6b1b6.jpg',
    alt: 'Cream macramé sunburst mirror',
    desc: 'Hand-knotted cotton pieces that soften any room — mirrors, wall hangings, plant hangers and bags.',
    subs: ['Mirrors', 'Wall hangings', 'Plant hangers', 'Bags & pouches'],
  },
  {
    slug: 'candles',
    name: 'Candles',
    ar: 'شموع',
    img: '/images/products/3611cd74.jpg',
    alt: 'Pink rose candle in a fuchsia resin holder',
    desc: 'Sculpted candles and rose candles in resin holders — for gifting, Ramadan nights and Halloween.',
    subs: ['Rose candle holders', 'Skull candles', 'Seasonal candles', 'Ramadan candles'],
  },
];

export const bestSellers: { id: string; meta: string }[] = [
  { id: 'coco-052', meta: 'Board games · 6 colourways' },
  { id: 'coco-010', meta: 'Resin · real seashells' },
  { id: 'coco-062', meta: 'Board games · 4 colourways' },
  { id: 'coco-091', meta: 'Candles · 4 colourways' },
];

export const workshops = [
  {
    id: 'resin',
    name: 'Resin art',
    ar: 'ريزن آرت',
    tag: 'Most popular',
    img: '/images/products/a3465002.jpg',
    alt: 'Blue floral resin coasters',
    desc: 'Mix pigments, play with cells and lacing, and seal in gold leaf. You leave with your own ocean coasters or tray.',
    day1: 'Colour theory, safe mixing and your first pour',
    day2: 'Demould, sand and polish to a glass finish',
  },
  {
    id: 'candles',
    name: 'Candle making',
    ar: 'صناعة الشموع',
    tag: 'Cosy & calm',
    img: '/images/legacy-crops/workshop.jpg',
    alt: 'Guests making candles around a long table',
    desc: 'Choose wax, wick and fragrance, then pour candles in jars and moulds — dried flowers and all.',
    day1: 'Wax types, scent blending and the pour',
    day2: 'Trim, label and decorate your candles',
  },
  {
    id: 'decoupage',
    name: 'Decoupage',
    ar: 'ديكوباج',
    tag: 'Beginner friendly',
    img: '/images/products/d91959e3.jpg',
    alt: 'Old Cairo decoupage tray',
    desc: 'Turn plain wooden boxes and trays into patterned keepsakes with papers, paints and varnish.',
    day1: 'Prep the surface and lay your design',
    day2: 'Seal, distress and varnish the final piece',
  },
  {
    id: 'concrete',
    name: 'Concrete art',
    ar: 'فن الخرسانة',
    tag: 'Modern decor',
    img: '/images/legacy-crops/pyramids.jpg',
    alt: 'Concrete pyramids made in class',
    desc: 'Cast planters, trays and sculptural decor in concrete, then finish them with colour and gold.',
    day1: 'Mix, cast and set your moulds',
    day2: 'Demould, paint and finish your decor',
  },
] as const;

export const instagramTiles = [
  { img: '/images/legacy-crops/coasters.jpg', alt: 'Resin coaster close-up' },
  { img: '/images/legacy-crops/bouquet.jpg', alt: 'Holiday bouquet with a name ribbon' },
  { img: '/images/legacy-crops/xo.jpg', alt: 'Resin XO board' },
  { img: '/images/legacy-crops/workshop.jpg', alt: 'Candle-making workshop' },
  { img: '/images/legacy-crops/skull.jpg', alt: 'Marbled resin skull' },
  { img: '/images/legacy-crops/pyramids.jpg', alt: 'Concrete pyramids' },
];
