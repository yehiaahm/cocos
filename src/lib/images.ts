import manifest from '../generated/image-manifest.json';

interface Entry {
  w: number;
  h: number;
  widths: number[];
  base: string;
}

const m = manifest as Record<string, Entry>;

export interface ImageSources {
  src: string;
  srcSet?: string;
  width?: number;
  height?: number;
}

/**
 * Responsive WebP sources for a photo under /images. Falls back to the original
 * file when it was not processed (e.g. a new photo added without re-running the build).
 */
export function imageSources(path: string, maxWidth?: number): ImageSources {
  const e = m[path];
  if (!e) return { src: path };
  const widths = maxWidth ? e.widths.filter((w, i) => w <= maxWidth || i === 0) : e.widths;
  const largest = widths[widths.length - 1];
  return {
    src: `${e.base}-${largest}.webp`,
    srcSet: widths.map((w) => `${e.base}-${w}.webp ${w}w`).join(', '),
    width: e.w,
    height: e.h,
  };
}

/** A single mid-size WebP URL (for tiny thumbnails, the fly-to-cart clone, JSON-LD, etc.). */
export function imageUrl(path: string, target = 640): string {
  const e = m[path];
  if (!e) return path;
  const w = e.widths.find((x) => x >= target) ?? e.widths[e.widths.length - 1];
  return `${e.base}-${w}.webp`;
}
