// One-off generator for favicons, app icons and the Open Graph image.
// Outputs are committed to public/, so this only needs re-running if the brand changes:
//   node scripts/make-brand-assets.mjs
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = (p) => path.join(root, 'public', p);
const svg = await readFile(pub('favicon.svg'));

// Square icon on the brand's cream background (iOS/Android don't like transparency).
async function makeIcon(size, file, padRatio = 0.1) {
  const inner = Math.round(size * (1 - padRatio * 2));
  const logo = await sharp(svg, { density: 600 }).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: '#F7F3EC' } })
    .composite([{ input: logo, top: Math.round((size - inner) / 2), left: Math.round((size - inner) / 2) }])
    .png()
    .toFile(pub(file));
}

await sharp(svg, { density: 300 }).resize(32, 32).png().toFile(pub('favicon-32.png'));
await makeIcon(180, 'apple-touch-icon.png', 0.08);
await makeIcon(192, 'icon-192.png', 0.08);
await makeIcon(512, 'icon-512.png', 0.08);
await makeIcon(512, 'icon-maskable-512.png', 0.2);

// Open Graph image, 1200×630: copy on the left, three product photos on the right.
const W = 1200;
const H = 630;
const photo = async (file, w, h, r) => {
  const mask = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}"/></svg>`);
  return sharp(path.join(root, 'public/images/products', file))
    .rotate()
    .resize(w, h, { fit: 'cover' })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
};
const text = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="b" cx=".4" cy=".4" r=".6"><stop offset="0" stop-color="#4FD1C5" stop-opacity=".35"/><stop offset="1" stop-color="#4FD1C5" stop-opacity="0"/></radialGradient>
    <linearGradient id="c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4FD1C5"/><stop offset=".55" stop-color="#14A3A0"/><stop offset="1" stop-color="#0B4F5A"/></linearGradient>
  </defs>
  <circle cx="980" cy="80" r="420" fill="url(#b)"/>
  <g transform="translate(72 70) scale(.36)">
    <circle cx="100" cy="100" r="96" fill="#fff"/>
    <path d="M150 52 A66 66 0 1 0 156 140" fill="none" stroke="url(#c)" stroke-width="30" stroke-linecap="round"/>
  </g>
  <text x="152" y="108" font-family="Georgia, serif" font-style="italic" font-size="38" fill="#8A6A1F">Coco's</text>
  <text x="154" y="132" font-family="Arial, sans-serif" font-weight="700" font-size="14" letter-spacing="5" fill="#0B2E33">ART</text>
  <text x="72" y="300" font-family="Georgia, serif" font-size="76" fill="#0B2E33">Art you can</text>
  <text x="72" y="384" font-family="Georgia, serif" font-size="76" font-style="italic" fill="#8A6A1F">hold,</text>
  <text x="72" y="468" font-family="Georgia, serif" font-size="76" fill="#0B2E33">poured by hand.</text>
  <text x="74" y="548" font-family="Arial, sans-serif" font-weight="700" font-size="20" letter-spacing="3" fill="#0E6F6C">HANDMADE HOME DECOR · EGYPT</text>
</svg>`);

await sharp({ create: { width: W, height: H, channels: 3, background: '#F7F3EC' } })
  .composite([
    { input: text, top: 0, left: 0 },
    { input: await photo('4c968890.jpg', 300, 380, 28), top: 60, left: 650 },
    { input: await photo('2d4c7956.jpg', 230, 230, 115), top: 360, left: 900 },
    { input: await photo('3611cd74.jpg', 200, 250, 24), top: 70, left: 970 },
  ])
  .jpeg({ quality: 84, mozjpeg: true })
  .toFile(pub('og-image.jpg'));

console.log('[brand] favicon-32.png, apple-touch-icon.png, icon-192/512.png, icon-maskable-512.png, og-image.jpg');
