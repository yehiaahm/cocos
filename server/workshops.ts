import type { AdminWorkshop, AdminWorkshopInput, PublicWorkshop } from '../src/lib/api-types';
import { FALLBACK_WORKSHOP_IMAGE, defaultWorkshops } from '../src/lib/workshops';
import { SLUG_RE, slugify } from '../src/lib/slug';
import { HttpError, intOrNull, randomToken, str } from './http';

/**
 * Workshops shown on the homepage, managed from the dashboard.
 *
 * - src/lib/workshops.ts (the four built into the site) is only the starting point: the first dashboard request copies
 *   it into the `workshops` table, once, and never again (even if everything is deleted later).
 * - The shop keeps using the built-in list until the owner changes something. Every change bumps
 *   `settings.workshops_rev`; GET /api/catalog sends the table's workshops whenever that is above 0.
 */
export const LIMITS = { workshops: 40 };

/** Photos shipped with the site or uploaded from the dashboard; nothing else may be referenced. */
export const WORKSHOP_IMAGE_RE = /^\/(?:images\/(?:products|legacy-crops)|media\/catalog)\/[A-Za-z0-9._-]+\.(?:jpe?g|png|webp)$/i;

interface WorkshopRow {
  id: string;
  name: string;
  name_ar: string;
  tag: string;
  image: string;
  alt: string;
  description: string;
  day1: string;
  day2: string;
  price: number | null;
  dates: string;
  active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const toPublic = (r: WorkshopRow): PublicWorkshop => ({
  id: r.id,
  name: r.name,
  nameAr: r.name_ar,
  tag: r.tag,
  image: r.image,
  alt: r.alt,
  description: r.description,
  day1: r.day1,
  day2: r.day2,
  price: r.price,
  dates: r.dates,
});

const toAdmin = (r: WorkshopRow): AdminWorkshop => ({ ...toPublic(r), active: !!r.active, createdAt: r.created_at, updatedAt: r.updated_at });

const seededDbs = new WeakSet<object>();

/** Copies the built-in workshops into the table the first time, and never again. */
export async function ensureSeeded(db: D1Database): Promise<void> {
  if (seededDbs.has(db)) return;
  const done = await db.prepare("SELECT 1 AS x FROM settings WHERE key = 'workshops_seeded'").first<{ x: number }>();
  if (!done) {
    await db.batch([
      ...defaultWorkshops.map((w, i) =>
        db
          .prepare(
            'INSERT OR IGNORE INTO workshops (id, name, name_ar, tag, image, alt, description, day1, day2, price, dates, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .bind(w.id, w.name, w.nameAr, w.tag, w.image, w.alt, w.description, w.day1, w.day2, w.price, w.dates, i),
      ),
      db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('workshops_seeded', '1')"),
    ]);
  }
  seededDbs.add(db);
}

const bumpRev = (db: D1Database) =>
  db.prepare("INSERT INTO settings (key, value) VALUES ('workshops_rev', '1') ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT)");

/** 0 = the owner has not changed anything yet, so the shop's built-in list is exact. */
export async function workshopsRev(db: D1Database): Promise<number> {
  const row = await db.prepare("SELECT value FROM settings WHERE key = 'workshops_rev'").first<{ value: string }>();
  return Number(row?.value) || 0;
}

/** What the shop gets: visible workshops only, in display order — or null while nothing was changed (use the built-in list). */
export async function loadPublicWorkshops(db: D1Database): Promise<{ rev: number; workshops: PublicWorkshop[] | null }> {
  const rev = await workshopsRev(db);
  if (rev === 0) return { rev, workshops: null };
  const { results } = await db.prepare('SELECT * FROM workshops WHERE active = 1 ORDER BY sort_order, id').all<WorkshopRow>();
  return { rev, workshops: results.map(toPublic) };
}

/** Every workshop (hidden ones too) for the dashboard. */
export async function listWorkshops(db: D1Database): Promise<AdminWorkshop[]> {
  await ensureSeeded(db);
  const { results } = await db.prepare('SELECT * FROM workshops ORDER BY sort_order, id').all<WorkshopRow>();
  return results.map(toAdmin);
}

export async function getWorkshop(db: D1Database, id: string): Promise<AdminWorkshop | null> {
  await ensureSeeded(db);
  const r = await db.prepare('SELECT * FROM workshops WHERE id = ?').bind(id).first<WorkshopRow>();
  return r ? toAdmin(r) : null;
}

const bad = (message: string, code: string) => new HttpError(400, message, code);
const notFound = () => new HttpError(404, 'Workshop not found.', 'not_found');

export interface WorkshopValues {
  name: string;
  name_ar: string;
  tag: string;
  image: string;
  alt: string;
  description: string;
  day1: string;
  day2: string;
  price: number | null;
  dates: string;
  active: number;
}

/** Checks everything the dashboard sends. Error codes map to messages in src/admin/i18n.ts (err.*). */
export function parseWorkshopInput(b: Partial<AdminWorkshopInput>): WorkshopValues {
  const name = str(b.name, 60);
  if (name.length < 2) throw bad('Please enter the workshop name (at least 2 characters).', 'ws_name_required');
  const image = str(b.image, 200);
  if (image && !WORKSHOP_IMAGE_RE.test(image)) throw bad('The photo is not valid. Upload it again.', 'invalid_image');
  let price: number | null;
  try {
    price = intOrNull(b.price, { min: 1, max: 1_000_000 });
  } catch {
    throw bad('The price must be a whole number of pounds.', 'ws_price');
  }
  const day1 = str(b.day1, 200);
  const day2 = str(b.day2, 200);
  if (day2 && !day1) throw bad('Fill in day 1 before day 2.', 'ws_day1_required');
  return {
    name,
    name_ar: str(b.nameAr, 60),
    tag: str(b.tag, 30),
    image: image || FALLBACK_WORKSHOP_IMAGE,
    alt: str(b.alt, 140),
    description: str(b.description, 600),
    day1,
    day2,
    price,
    dates: str(b.dates, 120),
    active: b.active === false ? 0 : 1,
  };
}

/** Dashboard input for an existing workshop (PATCH sends only what changed). */
export const inputFromWorkshop = (w: AdminWorkshop): AdminWorkshopInput => ({
  name: w.name,
  nameAr: w.nameAr,
  tag: w.tag,
  image: w.image,
  alt: w.alt,
  description: w.description,
  day1: w.day1,
  day2: w.day2,
  price: w.price,
  dates: w.dates,
  active: w.active,
});

/** A web-safe id from the English name; falls back to a random one when the name has no Latin letters. */
function freshId(name: string, taken: Set<string>): string {
  const base = slugify(name);
  const root = SLUG_RE.test(base) ? base.slice(0, 40).replace(/-+$/, '') : `workshop-${randomToken(4).toLowerCase().replace(/[^a-z0-9]/g, 'x')}`;
  if (!taken.has(root)) return root;
  for (let n = 2; ; n++) {
    const candidate = `${root}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export async function createWorkshop(db: D1Database, v: WorkshopValues): Promise<string> {
  await ensureSeeded(db);
  const { results } = await db.prepare('SELECT id, sort_order FROM workshops').all<{ id: string; sort_order: number }>();
  if (results.length >= LIMITS.workshops) throw bad(`At most ${LIMITS.workshops} workshops.`, 'ws_full');
  const id = freshId(v.name, new Set(results.map((r) => r.id)));
  // After every existing one, so a new workshop is the last tab.
  const next = results.reduce((m, r) => Math.max(m, r.sort_order), -1) + 1;
  await db.batch([
    db
      .prepare(
        'INSERT INTO workshops (id, name, name_ar, tag, image, alt, description, day1, day2, price, dates, active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(id, v.name, v.name_ar, v.tag, v.image, v.alt, v.description, v.day1, v.day2, v.price, v.dates, v.active, next),
    bumpRev(db),
  ]);
  return id;
}

export async function updateWorkshop(db: D1Database, id: string, v: WorkshopValues): Promise<void> {
  if (!(await getWorkshop(db, id))) throw notFound();
  await db.batch([
    db
      .prepare(
        `UPDATE workshops SET name = ?, name_ar = ?, tag = ?, image = ?, alt = ?, description = ?, day1 = ?, day2 = ?, price = ?, dates = ?, active = ?,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
      )
      .bind(v.name, v.name_ar, v.tag, v.image, v.alt, v.description, v.day1, v.day2, v.price, v.dates, v.active, id),
    bumpRev(db),
  ]);
}

export async function deleteWorkshop(db: D1Database, id: string): Promise<void> {
  if (!(await getWorkshop(db, id))) throw notFound();
  await db.batch([db.prepare('DELETE FROM workshops WHERE id = ?').bind(id), bumpRev(db)]);
}

/** Saves the display order. `order` must list every workshop exactly once. */
export async function reorderWorkshops(db: D1Database, order: unknown): Promise<void> {
  await ensureSeeded(db);
  const { results } = await db.prepare('SELECT id FROM workshops').all<{ id: string }>();
  const ids = new Set(results.map((r) => r.id));
  if (!Array.isArray(order) || order.length !== ids.size || new Set(order).size !== ids.size || order.some((o) => typeof o !== 'string' || !ids.has(o))) {
    throw bad('The order must list every workshop once.', 'bad_order');
  }
  await db.batch([...(order as string[]).map((id, i) => db.prepare('UPDATE workshops SET sort_order = ? WHERE id = ?').bind(i, id)), bumpRev(db)]);
}
