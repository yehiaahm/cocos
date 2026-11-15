import { api } from './api';
import { t } from './i18n';

/** Longest side of the photo that is stored, and of the small copy used on phones / thumbnails. */
export const FULL_EDGE = 1400;
export const THUMB_EDGE = 480;
const QUALITY = 0.86;

async function decode(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('empty');
    return img;
  } catch {
    throw new Error(t('pe.photoRead'));
  } finally {
    // The decoded bitmap stays usable after the URL is revoked.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** Draws the photo no bigger than `edge` px on its longest side (never enlarged) and encodes it as JPEG. */
function toJpeg(img: HTMLImageElement, edge: number): Promise<Blob> {
  const scale = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error(t('pe.photoRead')));
  ctx.fillStyle = '#fff'; // transparent PNGs get a white background instead of black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(t('pe.photoRead')))), 'image/jpeg', QUALITY),
  );
}

/**
 * Shrinks a photo in the browser (phone photos are 3–10 MB) and uploads a 1400 px copy plus a 480 px copy.
 * Resolves with the URL to store in the product's image list.
 */
export async function uploadPhoto(file: File): Promise<string> {
  const img = await decode(file);
  const [full, thumb] = await Promise.all([toJpeg(img, FULL_EDGE), toJpeg(img, THUMB_EDGE)]);
  const body = new FormData();
  body.set('full', full, 'photo.jpg');
  body.set('thumb', thumb, 'photo-480.jpg');
  const res = await api<{ url: string }>('/api/admin/media', { method: 'POST', body });
  return res.url;
}
