// @vitest-environment node
// (server code runs on Node/Workers, and jsdom's FormData is not the one Request/Response understand)
import { describe, expect, it } from 'vitest';
import { HttpError, readBodyText, readFormData, readJson } from './http';

const enc = new TextEncoder();

/** A request whose body arrives as chunks with NO content-length (like a chunked upload). Reports how many chunks were pulled. */
function chunked(chunks: Uint8Array[], headers: Record<string, string> = { 'content-type': 'application/json' }) {
  let pulled = 0;
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= chunks.length) return controller.close();
      pulled++;
      controller.enqueue(chunks[i++]);
    },
  });
  const request = new Request('https://shop.test/api/x', { method: 'POST', headers, body, duplex: 'half' } as RequestInit);
  return { request, pulled: () => pulled };
}

const status = async (p: Promise<unknown>) => {
  try {
    await p;
    return 0;
  } catch (e) {
    return e instanceof HttpError ? e.status : -1;
  }
};

describe('readJson size limit', () => {
  it('parses a normal body', async () => {
    const r = new Request('https://shop.test/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"a":1}' });
    expect(await readJson<{ a: number }>(r, 100)).toEqual({ a: 1 });
  });

  it('rejects a declared Content-Length over the limit without reading the body', async () => {
    const { request, pulled } = chunked([enc.encode('{}')], { 'content-type': 'application/json', 'content-length': '5000000' });
    expect(await status(readJson(request, 2000))).toBe(413);
    expect(pulled()).toBeLessThanOrEqual(1); // 1 = the stream's own initial prefetch; the handler never reads it
  });

  it('stops reading a chunked body as soon as the limit is passed', async () => {
    const chunk = enc.encode('a'.repeat(1000));
    const { request, pulled } = chunked(Array.from({ length: 10_000 }, () => chunk)); // 10 MB on offer
    expect(await status(readJson(request, 2000))).toBe(413);
    expect(pulled()).toBeLessThan(10); // nowhere near all 10,000 chunks
  });

  it('counts bytes, not characters', async () => {
    const r = new Request('https://shop.test/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ t: 'ج'.repeat(100) }) });
    expect(await status(readJson(r, 150))).toBe(413); // 200 UTF-8 bytes of Arabic > 150, though only ~110 characters
  });

  it('decodes multi-byte characters split across chunks', async () => {
    const bytes = enc.encode('{"n":"جديد"}');
    const { request } = chunked([bytes.slice(0, 8), bytes.slice(8)]);
    expect(await readJson<{ n: string }>(request, 100)).toEqual({ n: 'جديد' });
  });

  it('still rejects non-JSON content types and invalid JSON', async () => {
    const r1 = new Request('https://shop.test/', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' });
    expect(await status(readJson(r1))).toBe(415);
    const r2 = new Request('https://shop.test/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' });
    expect(await status(readJson(r2))).toBe(400);
  });
});

describe('readBodyText / readFormData', () => {
  it('returns an empty string for a request with no body', async () => {
    expect(await readBodyText(new Request('https://shop.test/'), 10)).toBe('');
  });

  it('parses a small multipart upload', async () => {
    const fd = new FormData();
    fd.append('file', new Blob(['hello'], { type: 'image/png' }), 'x.png');
    const r = new Request('https://shop.test/', { method: 'POST', body: fd });
    const form = await readFormData(r, 10_000);
    const file = form?.get('file') as File;
    expect(file.type).toBe('image/png');
    expect(file.size).toBe(5);
  });

  it('refuses an oversized multipart upload (declared and chunked)', async () => {
    const declared = new Request('https://shop.test/', { method: 'POST', headers: { 'content-type': 'multipart/form-data; boundary=x', 'content-length': '99999999' }, body: 'x' });
    expect(await status(readFormData(declared, 1000))).toBe(413);

    const chunk = new Uint8Array(1000);
    const { request, pulled } = chunked(Array.from({ length: 10_000 }, () => chunk), { 'content-type': 'multipart/form-data; boundary=x' });
    expect(await status(readFormData(request, 5000))).toBe(413);
    expect(pulled()).toBeLessThan(20);
  });

  it('returns null for something that is not form data', async () => {
    const r = new Request('https://shop.test/', { method: 'POST', headers: { 'content-type': 'multipart/form-data; boundary=x' }, body: 'not multipart' });
    expect(await readFormData(r, 1000)).toBeNull();
  });
});
