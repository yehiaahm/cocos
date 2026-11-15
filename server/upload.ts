/** What an uploaded file actually is, judged by its first bytes — the browser-supplied MIME type is only a claim. */
export function sniffImage(head: Uint8Array): { type: string; ext: string } | null {
  const is = (...b: number[]) => b.every((v, i) => head[i] === v);
  if (is(0xff, 0xd8, 0xff)) return { type: 'image/jpeg', ext: 'jpg' };
  if (is(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { type: 'image/png', ext: 'png' };
  // WebP: "RIFF" <size> "WEBP"
  if (is(0x52, 0x49, 0x46, 0x46) && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50) {
    return { type: 'image/webp', ext: 'webp' };
  }
  return null;
}
