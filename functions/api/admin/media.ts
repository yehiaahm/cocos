import type { Fn } from '../../../server/env';
import { HttpError, handle, json, randomToken, readFormData } from '../../../server/http';
import { sniffImage } from '../../../server/upload';

const MAX_FILE = 5 * 1024 * 1024;

async function checked(file: unknown) {
  if (!file || typeof file === 'string') return null;
  const blob = file as File;
  if (blob.size > MAX_FILE) throw new HttpError(413, 'The photo is too large.', 'too_large');
  const sniffed = sniffImage(new Uint8Array(await blob.slice(0, 12).arrayBuffer()));
  if (!sniffed) throw new HttpError(415, 'Please upload a JPG, PNG or WebP photo.', 'bad_type');
  return { file: blob, ...sniffed };
}

/**
 * POST /api/admin/media (multipart) — a catalogue photo.
 *   full   the photo itself (the dashboard shrinks it to 1400 px first)
 *   thumb  optional 480 px copy, stored next to it as <name>-480.<ext> so the shop can serve small screens a small file
 * Replies { url } — the path to put in a product's image lists.
 */
export const onRequestPost: Fn = handle(async ({ request, env }) => {
  const form = await readFormData(request, 2 * MAX_FILE + 256 * 1024);
  const full = await checked(form?.get('full') ?? form?.get('file'));
  if (!full) throw new HttpError(400, 'Choose a photo to upload.', 'no_file');
  const thumb = await checked(form?.get('thumb'));
  if (thumb && thumb.type !== full.type) throw new HttpError(415, 'The small copy must be the same image type.', 'bad_type');

  const name = randomToken(9);
  await env.UPLOADS.put(`catalog/${name}.${full.ext}`, full.file.stream(), { httpMetadata: { contentType: full.type } });
  if (thumb) await env.UPLOADS.put(`catalog/${name}-480.${full.ext}`, thumb.file.stream(), { httpMetadata: { contentType: thumb.type } });
  return json({ url: `/media/catalog/${name}.${full.ext}` }, { status: 201 });
});
