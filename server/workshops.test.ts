// @vitest-environment node
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { NodeD1 } from './node/d1';
import type { Env } from './env';
import { HttpError } from './http';
import { defaultWorkshops } from '../src/lib/workshops';
import {
  createWorkshop,
  deleteWorkshop,
  getWorkshop,
  inputFromWorkshop,
  listWorkshops,
  loadPublicWorkshops,
  parseWorkshopInput,
  reorderWorkshops,
  updateWorkshop,
} from './workshops';
import * as publicCatalog from '../functions/api/catalog';
import * as adminWorkshops from '../functions/api/admin/workshops';
import * as adminWorkshop from '../functions/api/admin/workshops/[id]';

const fresh = () => {
  const db = new NodeD1(':memory:');
  db.migrate(path.resolve(__dirname, '../migrations'));
  return db as unknown as D1Database;
};

const code = async (p: Promise<unknown> | (() => unknown)) => {
  try {
    await (typeof p === 'function' ? p() : p);
  } catch (e) {
    if (e instanceof HttpError) return e.code;
    throw e;
  }
  return 'ok';
};

const input = (over: Record<string, unknown> = {}) => ({ name: 'Macramé basics', description: 'Knot a wall hanging.', day1: 'Knots', ...over });

describe('workshops: validation', () => {
  it('needs a name of at least 2 characters', () => {
    expect(() => parseWorkshopInput(input({ name: ' a ' }))).toThrow(HttpError);
    expect(parseWorkshopInput(input({ name: '  Ab  ' })).name).toBe('Ab');
  });

  it('falls back to the standard photo and refuses photos from anywhere else', () => {
    expect(parseWorkshopInput(input()).image).toBe('/images/legacy-crops/workshop.jpg');
    expect(parseWorkshopInput(input({ image: '/media/catalog/abc123.jpg' })).image).toBe('/media/catalog/abc123.jpg');
    expect(parseWorkshopInput(input({ image: '/images/legacy-crops/pyramids.jpg' })).image).toBe('/images/legacy-crops/pyramids.jpg');
    for (const bad of ['https://evil.example/x.jpg', '/media/proofs/abc.jpg', '/media/catalog/../x.jpg', '/images/products/a.svg']) {
      expect(() => parseWorkshopInput(input({ image: bad }))).toThrow(HttpError);
    }
  });

  it('accepts a price or none, but not nonsense', () => {
    expect(parseWorkshopInput(input({ price: '1200' })).price).toBe(1200);
    expect(parseWorkshopInput(input({ price: '' })).price).toBeNull();
    expect(parseWorkshopInput(input({ price: null })).price).toBeNull();
    for (const bad of [0, -5, 'abc', 2_000_000]) expect(() => parseWorkshopInput(input({ price: bad }))).toThrow(HttpError);
  });

  it('does not allow day 2 without day 1, and keeps one-session workshops', () => {
    expect(() => parseWorkshopInput(input({ day1: '', day2: 'Finish' }))).toThrow(HttpError);
    expect(parseWorkshopInput(input({ day2: '' })).day2).toBe('');
  });

  it('cuts text to its limits and treats active as on unless explicitly false', () => {
    const v = parseWorkshopInput(input({ tag: 'x'.repeat(100), dates: 'y'.repeat(500) }));
    expect(v.tag).toHaveLength(30);
    expect(v.dates).toHaveLength(120);
    expect(v.active).toBe(1);
    expect(parseWorkshopInput(input({ active: false })).active).toBe(0);
  });
});

describe('workshops: storage', () => {
  it('copies the built-in workshops in once and keeps the shop on the built-in list until something changes', async () => {
    const db = fresh();
    expect(await loadPublicWorkshops(db)).toEqual({ rev: 0, workshops: null });
    const list = await listWorkshops(db);
    expect(list.map((w) => w.id)).toEqual(defaultWorkshops.map((w) => w.id));
    expect(list.every((w) => w.active)).toBe(true);
    // Listing alone must not switch the shop over.
    expect((await loadPublicWorkshops(db)).workshops).toBeNull();
  });

  it('adds a workshop as the last tab with an id made from its name', async () => {
    const db = fresh();
    const id = await createWorkshop(db, parseWorkshopInput(input()));
    expect(id).toBe('macrame-basics');
    const list = await listWorkshops(db);
    expect(list).toHaveLength(defaultWorkshops.length + 1);
    expect(list.at(-1)?.id).toBe(id);
    const pub = await loadPublicWorkshops(db);
    expect(pub.rev).toBe(1);
    expect(pub.workshops?.map((w) => w.id)).toContain(id);
  });

  it('gives unique ids to equal names and to Arabic-only names', async () => {
    const db = fresh();
    const a = await createWorkshop(db, parseWorkshopInput(input({ name: 'Resin' })));
    const b = await createWorkshop(db, parseWorkshopInput(input({ name: 'ورشة الشموع' })));
    const c = await createWorkshop(db, parseWorkshopInput(input({ name: 'ورشة الشموع' })));
    expect(a).toBe('resin-2'); // "resin" is the built-in one
    expect(b).toMatch(/^workshop-[a-z0-9]+$/);
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it('edits only what changed and keeps the id', async () => {
    const db = fresh();
    const before = (await getWorkshop(db, 'resin'))!;
    await updateWorkshop(db, 'resin', parseWorkshopInput({ ...inputFromWorkshop(before), price: 950, day2: '' }));
    const after = (await getWorkshop(db, 'resin'))!;
    expect(after.id).toBe('resin');
    expect(after.price).toBe(950);
    expect(after.day2).toBe('');
    expect(after.name).toBe(before.name);
    expect(await code(updateWorkshop(db, 'nope', parseWorkshopInput(input())))).toBe('not_found');
  });

  it('hides a workshop from the shop without deleting it', async () => {
    const db = fresh();
    const w = (await getWorkshop(db, 'candles'))!;
    await updateWorkshop(db, 'candles', parseWorkshopInput({ ...inputFromWorkshop(w), active: false }));
    expect((await loadPublicWorkshops(db)).workshops?.map((x) => x.id)).toEqual(['resin', 'decoupage', 'concrete']);
    expect((await listWorkshops(db)).find((x) => x.id === 'candles')?.active).toBe(false);
  });

  it('can delete every workshop: the shop then gets an empty list, not the built-in ones back', async () => {
    const db = fresh();
    for (const w of await listWorkshops(db)) await deleteWorkshop(db, w.id);
    expect(await listWorkshops(db)).toEqual([]); // not re-seeded
    const pub = await loadPublicWorkshops(db);
    expect(pub.workshops).toEqual([]);
    expect(await code(deleteWorkshop(db, 'resin'))).toBe('not_found');
  });

  it('reorders, and refuses an order that is not a permutation', async () => {
    const db = fresh();
    await reorderWorkshops(db, ['concrete', 'decoupage', 'candles', 'resin']);
    expect((await listWorkshops(db)).map((w) => w.id)).toEqual(['concrete', 'decoupage', 'candles', 'resin']);
    for (const bad of [['resin'], ['resin', 'resin', 'candles', 'decoupage'], 'resin', ['a', 'b', 'c', 'd'], null]) {
      expect(await code(reorderWorkshops(db, bad))).toBe('bad_order');
    }
  });
});

describe('workshops: API', () => {
  const ctx = (db: D1Database, request: Request, params: Record<string, string> = {}) => ({ request, env: { DB: db } as unknown as Env, params }) as never;
  const post = (url: string, body: unknown, method = 'POST') =>
    new Request(`http://x${url}`, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  it('creates, patches and deletes through the admin routes, and /api/catalog follows', async () => {
    const db = fresh();
    const publicBody = async () => (await (await publicCatalog.onRequestGet(ctx(db, new Request('http://x/api/catalog')))).json()) as { workshops?: { id: string }[] };

    // Untouched: the shop is told nothing, so it keeps the built-in list.
    expect((await publicBody()).workshops).toBeUndefined();

    const created = await adminWorkshops.onRequestPost(ctx(db, post('/api/admin/workshops', input({ price: 800 }))));
    expect(created.status).toBe(201);
    const { workshop } = (await created.json()) as { workshop: { id: string; price: number } };
    expect(workshop.price).toBe(800);
    expect((await publicBody()).workshops?.map((w) => w.id)).toContain(workshop.id);

    const patched = await adminWorkshop.onRequestPatch(ctx(db, post(`/api/admin/workshops/${workshop.id}`, { active: false }, 'PATCH'), { id: workshop.id }));
    expect(patched.status).toBe(200);
    expect((await publicBody()).workshops?.map((w) => w.id)).not.toContain(workshop.id);

    const bad = await adminWorkshops.onRequestPost(ctx(db, post('/api/admin/workshops', input({ name: '' }))));
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { code: string }).code).toBe('ws_name_required');

    const missing = await adminWorkshop.onRequestPatch(ctx(db, post('/api/admin/workshops/zzz', { active: false }, 'PATCH'), { id: 'zzz' }));
    expect(missing.status).toBe(404);
    const weird = await adminWorkshop.onRequestDelete(ctx(db, new Request('http://x/api/admin/workshops/../x', { method: 'DELETE' }), { id: '../x' }));
    expect(weird.status).toBe(404);

    const del = await adminWorkshop.onRequestDelete(ctx(db, new Request('http://x', { method: 'DELETE' }), { id: workshop.id }));
    expect(del.status).toBe(200);
    expect(await getWorkshop(db, workshop.id)).toBeNull();
  });
});
