// A Cloudflare R2–compatible bucket on the local filesystem (a Railway volume in production).
// Implements put/get/delete/head, which is all functions/ uses (payment screenshots).
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

interface HttpMetadata {
  contentType?: string;
}
interface PutOptions {
  httpMetadata?: HttpMetadata;
}
type PutValue = ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob | null;

export class FileBucket {
  constructor(private dir: string) {}

  private file(key: string): string {
    const clean = path.posix.normalize(key).replace(/^\/+/, '');
    if (!clean || clean.startsWith('..') || clean.includes('\0')) throw new Error(`Invalid object key: ${key}`);
    return path.join(this.dir, ...clean.split('/'));
  }

  async put(key: string, value: PutValue, opts: PutOptions = {}) {
    const file = this.file(key);
    await mkdir(path.dirname(file), { recursive: true });
    let data: Buffer;
    if (value == null) data = Buffer.alloc(0);
    else if (typeof value === 'string') data = Buffer.from(value);
    else if (value instanceof ArrayBuffer) data = Buffer.from(value);
    else if (ArrayBuffer.isView(value)) data = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
    else if (value instanceof Blob) data = Buffer.from(await value.arrayBuffer());
    else data = Buffer.from(await new Response(value).arrayBuffer());
    await writeFile(file, data);
    await writeFile(`${file}.meta.json`, JSON.stringify({ httpMetadata: opts.httpMetadata ?? {}, uploaded: new Date().toISOString() }));
    return { key, size: data.length, httpMetadata: opts.httpMetadata ?? {} };
  }

  async head(key: string) {
    const file = this.file(key);
    try {
      const s = await stat(file);
      let httpMetadata: HttpMetadata = {};
      try {
        httpMetadata = JSON.parse(await readFile(`${file}.meta.json`, 'utf8')).httpMetadata ?? {};
      } catch {
        /* no metadata */
      }
      return { key, size: s.size, uploaded: s.mtime, httpMetadata };
    } catch {
      return null;
    }
  }

  async get(key: string) {
    const meta = await this.head(key);
    if (!meta) return null;
    const file = this.file(key);
    return {
      ...meta,
      get body() {
        return Readable.toWeb(createReadStream(file)) as unknown as ReadableStream;
      },
      arrayBuffer: async () => {
        const b = await readFile(file);
        return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
      },
      writeHttpMetadata(headers: Headers) {
        if (meta.httpMetadata.contentType) headers.set('content-type', meta.httpMetadata.contentType);
      },
    };
  }

  async delete(keys: string | string[]) {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      const file = this.file(key);
      await rm(file, { force: true });
      await rm(`${file}.meta.json`, { force: true });
    }
  }
}
