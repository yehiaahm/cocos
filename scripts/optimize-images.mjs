// Generates responsive WebP versions of every photo in public/images/{products,legacy-crops}
// and a manifest (intrinsic size + available widths) used by the <Picture> component.
// Originals are never modified. Already-generated files are skipped, so re-runs are fast.
import { readdir, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public');
const SOURCE_DIRS = ['images/products', 'images/legacy-crops'];
const WIDTHS = [320, 480, 720, 960, 1400];
const OUT = path.join(pub, 'images/opt');
const MANIFEST = path.join(root, 'src/generated/image-manifest.json');

const exists = async (p) => {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
};

const manifest = {};
let made = 0;

for (const dir of SOURCE_DIRS) {
  const abs = path.join(pub, dir);
  const outDir = path.join(OUT, path.basename(dir));
  await mkdir(outDir, { recursive: true });
  const files = (await readdir(abs)).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();

  await Promise.all(
    files.map(async (file) => {
      const src = path.join(abs, file);
      const base = file.replace(/\.[^.]+$/, '');
      const img = sharp(src).rotate();
      const meta = await img.metadata();
      // .rotate() honours EXIF orientation, so swap dimensions for 90° rotations.
      const swap = (meta.orientation ?? 1) >= 5;
      const w = swap ? meta.height : meta.width;
      const h = swap ? meta.width : meta.height;
      const widths = WIDTHS.filter((x) => x < w);
      widths.push(Math.min(w, WIDTHS.at(-1)));
      const uniq = [...new Set(widths)].sort((a, b) => a - b);

      for (const width of uniq) {
        const out = path.join(outDir, `${base}-${width}.webp`);
        if (await exists(out)) continue;
        await sharp(src).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 78, effort: 5 }).toFile(out);
        made++;
      }
      manifest[`/${dir}/${file}`] = { w, h, widths: uniq, base: `/images/opt/${path.basename(dir)}/${base}` };
    }),
  );
}

await mkdir(path.dirname(MANIFEST), { recursive: true });
const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(MANIFEST, JSON.stringify(sorted, null, 0) + '\n');
console.log(`[images] ${Object.keys(manifest).length} photos, ${made} new WebP files written`);
