import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

/** The subset of Cloudflare R2's API the app uses (put/get/delete), stored as files on disk (a Railway Volume). */
export class FileR2 {
  constructor(private root: string) {}

  private file(key: string) {
    const root = path.resolve(this.root);
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) throw new Error('Invalid key');
    return full;
  }

  async put(key: string, body: ReadableStream | ArrayBuffer | Uint8Array | Blob, opts?: { httpMetadata?: { contentType?: string } }) {
    const full = this.file(key);
    await mkdir(path.dirname(full), { recursive: true });
    let buf: Buffer;
    if (body instanceof ReadableStream) buf = Buffer.from(await new Response(body).arrayBuffer());
    else if (body instanceof Blob) buf = Buffer.from(await body.arrayBuffer());
    else buf = Buffer.from(body as ArrayBuffer);
    await writeFile(full, buf);
    await writeFile(`${full}.meta.json`, JSON.stringify({ contentType: opts?.httpMetadata?.contentType ?? 'application/octet-stream' }));
    return { key };
  }

  async get(key: string) {
    const full = this.file(key);
    if (!existsSync(full)) return null;
    const data = await readFile(full);
    const meta = existsSync(`${full}.meta.json`) ? JSON.parse(await readFile(`${full}.meta.json`, 'utf8')) : {};
    return {
      body: new Blob([data]).stream(),
      httpMetadata: { contentType: meta.contentType as string | undefined },
      size: data.length,
    };
  }

  async delete(key: string) {
    const full = this.file(key);
    await rm(full, { force: true });
    await rm(`${full}.meta.json`, { force: true });
  }
}
