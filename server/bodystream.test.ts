// @vitest-environment node
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { limitedBody } from './node/bodystream';
import { HttpError, readBodyText } from './http';

// A tiny server wired the way server/node/server.ts wires request bodies.
let server: http.Server;
let port = 0;
const crashes: unknown[] = [];

beforeAll(async () => {
  process.on('uncaughtException', (e) => crashes.push(e));
  server = http.createServer(async (req, res) => {
    const request = new Request('http://x/', { method: 'POST', body: limitedBody(req, 1024 * 1024), duplex: 'half' } as RequestInit);
    try {
      const text = await readBodyText(request, 2000); // route-level cap, like readJson(…, 2000)
      res.writeHead(200).end(String(text.length));
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      res.writeHead(status, { connection: status === 413 ? 'close' : 'keep-alive' }).end();
    }
  });
  await new Promise<void>((r) => server.listen(0, r));
  port = (server.address() as AddressInfo).port;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

function post(totalBytes: number, chunked = true): Promise<{ status?: number; error?: string; sent: number }> {
  return new Promise((resolve) => {
    const headers: Record<string, string> = chunked ? { 'transfer-encoding': 'chunked' } : { 'content-length': String(totalBytes) };
    const req = http.request({ host: '127.0.0.1', port, method: 'POST', headers });
    let sent = 0;
    let done = false;
    const finish = (r: { status?: number; error?: string }) => {
      if (!done) {
        done = true;
        resolve({ ...r, sent });
      }
    };
    req.on('response', (res) => {
      res.resume();
      res.on('end', () => finish({ status: res.statusCode }));
    });
    req.on('error', (e: NodeJS.ErrnoException) => finish({ error: e.code }));
    const chunk = Buffer.alloc(64 * 1024, 97);
    const pump = () => {
      while (!done && sent < totalBytes) {
        const part = chunk.subarray(0, Math.min(chunk.length, totalBytes - sent));
        sent += part.length;
        if (!req.write(part)) return void req.once('drain', pump);
      }
      if (!done) req.end();
    };
    pump();
  });
}

describe('limitedBody on a real Node server', () => {
  it('accepts a small body', async () => {
    const r = await post(1000, false);
    expect(r.status).toBe(200);
  });

  it('answers 413 to an oversized chunked upload, stops it early, and does not crash the process', async () => {
    const r = await post(30 * 1024 * 1024, true);
    expect(r.status === 413 || r.error === 'ECONNRESET' || r.error === 'EPIPE').toBe(true);
    expect(r.sent).toBeLessThan(10 * 1024 * 1024); // nowhere near all 30 MB
    await new Promise((res) => setTimeout(res, 200));
    expect(crashes).toEqual([]);
    expect((await post(100, false)).status).toBe(200); // server still serving
  });

  it('survives the global cap tripping (body over 1 MB but route never reads it)', async () => {
    const r = await post(5 * 1024 * 1024, true); // route cap (2000) trips first; global cap is the backstop
    expect([413, undefined]).toContain(r.status);
    await new Promise((res) => setTimeout(res, 200));
    expect(crashes).toEqual([]);
  });

  it('survives a client that disconnects mid-body', async () => {
    await new Promise<void>((resolve) => {
      const req = http.request({ host: '127.0.0.1', port, method: 'POST', headers: { 'transfer-encoding': 'chunked' } });
      req.on('error', () => resolve());
      req.write(Buffer.alloc(500, 97));
      setTimeout(() => {
        req.destroy();
        resolve();
      }, 50);
    });
    await new Promise((res) => setTimeout(res, 200));
    expect(crashes).toEqual([]);
    expect((await post(100, false)).status).toBe(200);
  });
});
