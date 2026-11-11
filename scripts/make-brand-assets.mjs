// Generates every logo-derived asset from the master logo file (brand/logo-source.jpg).
// Outputs are committed, so this only needs re-running if the logo changes:
//   node scripts/make-brand-assets.mjs
//
//   src/assets/brand/logo-{w}.webp   transparent full logo for the header/footer (hashed by Vite)
//   public/brand/logo.png            transparent full logo, high-res (structured data, press, downloads)
//   public/favicon.ico, favicon-32.png   the ring mark only (text is unreadable that small)
//   public/apple-touch-icon.png, icon-192/512.png, icon-maskable-512.png
//   public/og-image.jpg              1200×630 social preview
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = (p) => path.join(root, p);
const CREAM = '#F7F3EC';

await mkdir(out('public/brand'), { recursive: true });
await mkdir(out('src/assets/brand'), { recursive: true });

// ---------------------------------------------------------------------------
// 1. Cut the logo out of its white background.
//    Alpha comes from how far a pixel is from white, then the white is "un-mixed"
//    from the colour so anti-aliased edges stay clean on any background.
// ---------------------------------------------------------------------------
const src = await sharp(out('brand/logo-source.jpg')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: SW, height: SH } = src.info;
const rgba = Buffer.alloc(SW * SH * 4);
const NOISE = 10; // JPEG noise around pure white
const SOLID = 70; // distance from white at which a pixel is fully opaque
for (let i = 0, j = 0; i < src.data.length; i += 3, j += 4) {
  const r = src.data[i], g = src.data[i + 1], b = src.data[i + 2];
  const d = 255 - Math.min(r, g, b);
  const a = Math.min(1, Math.max(0, (d - NOISE) / (SOLID - NOISE)));
  const un = (c) => (a > 0 ? Math.max(0, Math.min(255, Math.round((c - 255 * (1 - a)) / a))) : 0);
  rgba[j] = un(r);
  rgba[j + 1] = un(g);
  rgba[j + 2] = un(b);
  rgba[j + 3] = Math.round(a * 255);
}
const cut = await sharp(rgba, { raw: { width: SW, height: SH, channels: 4 } })
  .trim({ threshold: 1 })
  .png()
  .toBuffer({ resolveWithObject: true });
// A little breathing room so the brush texture never touches the box edge.
const PAD = Math.round(cut.info.width * 0.02);
const logo = await sharp(cut.data)
  .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer({ resolveWithObject: true });
const LW = logo.info.width;
const LH = logo.info.height;

await sharp(logo.data).png({ compressionLevel: 9, palette: true, quality: 95, effort: 10 }).toFile(out('public/brand/logo.png'));
for (const w of [160, 240, 320, 480]) {
  await sharp(logo.data).resize(w).webp({ quality: 90, alphaQuality: 95, effort: 6 }).toFile(out(`src/assets/brand/logo-${w}.webp`));
}

// ---------------------------------------------------------------------------
// 2. Ring mark only (for favicons). Anything that isn't teal/blue/navy paint (the gold
//    script and its grey shadow) is removed, and the places where it crossed the ring
//    are filled from the surrounding paint.
// ---------------------------------------------------------------------------
const MARK = 512;
const { data: px, info: mi } = await sharp(logo.data).resize(MARK, MARK, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).raw().toBuffer({ resolveWithObject: true });
const N = mi.width * mi.height;
const gold = new Uint8Array(N);
for (let p = 0; p < N; p++) {
  const r = px[p * 4], g = px[p * 4 + 1], b = px[p * 4 + 2], a = px[p * 4 + 3];
  const paint = b > r + 18 || (g > r + 30 && b > r) || (Math.max(r, g, b) < 70 && b >= r);
  if (a > 8 && !paint) gold[p] = 1;
}
// Dilate by 2px so the gold's anti-aliased fringe goes too.
let hole = gold;
for (let k = 0; k < 2; k++) {
  const next = new Uint8Array(hole);
  for (let y = 1; y < mi.height - 1; y++)
    for (let x = 1; x < mi.width - 1; x++) {
      const p = y * mi.width + x;
      if (hole[p - 1] || hole[p + 1] || hole[p - mi.width] || hole[p + mi.width]) next[p] = 1;
    }
  hole = next;
}
// Diffusion fill on premultiplied colour: holes inside the ring become ring paint,
// holes over empty space fade to transparent.
const f = new Float32Array(N * 4);
for (let p = 0; p < N; p++) {
  const a = hole[p] ? 0 : px[p * 4 + 3] / 255;
  f[p * 4] = hole[p] ? 0 : px[p * 4] * a;
  f[p * 4 + 1] = hole[p] ? 0 : px[p * 4 + 1] * a;
  f[p * 4 + 2] = hole[p] ? 0 : px[p * 4 + 2] * a;
  f[p * 4 + 3] = a;
}
const holes = [];
for (let p = 0; p < N; p++) if (hole[p]) holes.push(p);
for (let it = 0; it < 120; it++) {
  for (const p of holes) {
    const n = [p - 1, p + 1, p - mi.width, p + mi.width];
    for (let c = 0; c < 4; c++) f[p * 4 + c] = (f[n[0] * 4 + c] + f[n[1] * 4 + c] + f[n[2] * 4 + c] + f[n[3] * 4 + c]) / 4;
  }
}
const markRaw = Buffer.alloc(N * 4);
for (let p = 0; p < N; p++) {
  const a = f[p * 4 + 3];
  markRaw[p * 4 + 3] = Math.round(Math.min(1, a) * 255);
  for (let c = 0; c < 3; c++) markRaw[p * 4 + c] = a > 0.004 ? Math.round(Math.min(255, f[p * 4 + c] / a)) : 0;
}
const mark = await sharp(markRaw, { raw: { width: mi.width, height: mi.height, channels: 4 } }).png().toBuffer();

// Favicons: ring on a cream disc reads well on both light and dark browser tabs.
async function favicon(size) {
  const disc = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${CREAM}"/></svg>`);
  const inner = Math.round(size * 0.9);
  const ring = await sharp(mark).resize(inner, inner, { kernel: 'lanczos3' }).sharpen({ sigma: size < 40 ? 0.6 : 0.3 }).png().toBuffer();
  const off = Math.round((size - inner) / 2);
  return sharp(disc).composite([{ input: ring, top: off, left: off }]).png().toBuffer();
}
const fav16 = await favicon(16);
const fav32 = await favicon(32);
const fav48 = await favicon(48);
await writeFile(out('public/favicon-32.png'), fav32);

// favicon.ico with PNG-encoded 16/32/48 entries (supported by every current browser).
{
  const imgs = [[16, fav16], [32, fav32], [48, fav48]];
  const header = Buffer.alloc(6 + 16 * imgs.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(imgs.length, 4);
  let offset = header.length;
  imgs.forEach(([s, buf], i) => {
    const e = 6 + i * 16;
    header.writeUInt8(s, e);
    header.writeUInt8(s, e + 1);
    header.writeUInt8(0, e + 2);
    header.writeUInt8(0, e + 3);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(buf.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += buf.length;
  });
  await writeFile(out('public/favicon.ico'), Buffer.concat([header, ...imgs.map(([, b]) => b)]));
}


// ---------------------------------------------------------------------------
// 3. App icons: the full logo (text included) on cream — large enough to read.
// ---------------------------------------------------------------------------
async function makeIcon(size, file, padRatio) {
  const box = Math.round(size * (1 - padRatio * 2));
  const img = await sharp(logo.data).resize(box, box, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const off = Math.round((size - box) / 2);
  await sharp({ create: { width: size, height: size, channels: 4, background: CREAM } })
    .composite([{ input: img, top: off, left: off }])
    .png()
    .toFile(out(`public/${file}`));
}
await makeIcon(180, 'apple-touch-icon.png', 0.06);
await makeIcon(192, 'icon-192.png', 0.06);
await makeIcon(512, 'icon-512.png', 0.06);
await makeIcon(512, 'icon-maskable-512.png', 0.16); // stays inside the 80% maskable safe zone

// ---------------------------------------------------------------------------
// 4. Open Graph image, 1200×630: logo + copy on the left, three product photos on the right.
// ---------------------------------------------------------------------------
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
  </defs>
  <circle cx="980" cy="80" r="420" fill="url(#b)"/>
  <text x="72" y="318" font-family="Georgia, serif" font-size="72" fill="#0B2E33">Art you can</text>
  <text x="72" y="398" font-family="Georgia, serif" font-size="72" font-style="italic" fill="#8A6A1F">hold,</text>
  <text x="72" y="478" font-family="Georgia, serif" font-size="72" fill="#0B2E33">poured by hand.</text>
  <text x="74" y="552" font-family="Arial, sans-serif" font-weight="700" font-size="20" letter-spacing="3" fill="#0E6F6C">HANDMADE HOME DECOR · EGYPT</text>
</svg>`);
const OG_LOGO = 190;
const ogLogo = await sharp(logo.data).resize({ height: OG_LOGO }).png().toBuffer();

await sharp({ create: { width: W, height: H, channels: 3, background: CREAM } })
  .composite([
    { input: text, top: 0, left: 0 },
    { input: ogLogo, top: 34, left: 52 },
    { input: await photo('4c968890.jpg', 300, 380, 28), top: 60, left: 650 },
    { input: await photo('2d4c7956.jpg', 230, 230, 115), top: 360, left: 900 },
    { input: await photo('3611cd74.jpg', 200, 250, 24), top: 70, left: 970 },
  ])
  .jpeg({ quality: 84, mozjpeg: true })
  .toFile(out('public/og-image.jpg'));

console.log(`[brand] logo ${LW}×${LH} → src/assets/brand/logo-*.webp, public/brand/logo.png, favicons, app icons, og-image.jpg`);
