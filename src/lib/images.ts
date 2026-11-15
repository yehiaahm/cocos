import manifest from '../generated/image-manifest.json';

interface Entry {
  w: number;
  h: number;
  widths: number[];
  base: string;
}

const m = manifest as Record<string, Entry>;

/**
 * Photos uploaded from the dashboard live under /media/catalog/<name>.<ext>, with a 480 px copy next to them
 * (<name>-480.<ext>). They are not in the build-time manifest, so their two sizes are derived from the name.
 */
const UPLOADED = /^(\/media\/catalog\/[A-Za-z0-9_-]+)(\.[A-Za-z]+)$/;
export const uploadedThumb = (path: string): string | null => {
  const u = UPLOADED.exec(path);
  return u ? `${u[1]}-480${u[2]}` : null;
};

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
  if (!e) {
    const thumb = uploadedThumb(path);
    return thumb ? { src: path, srcSet: `${thumb} 480w, ${path} 1400w` } : { src: path };
  }
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
  if (!e) return target <= 480 ? (uploadedThumb(path) ?? path) : path;
  const w = e.widths.find((x) => x >= target) ?? e.widths[e.widths.length - 1];
  return `${e.base}-${w}.webp`;
}
