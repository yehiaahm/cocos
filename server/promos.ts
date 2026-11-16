import { HttpError, str } from './http';
import { PROMO_CODE_RE, PROMO_TYPES, normalisePromoCode, type PromoRules, type PromoType } from '../src/lib/promo';
import type { AdminPromo, AdminPromoInput, PromoState, PublicPromo } from '../src/lib/api-types';

/**
 * Promo codes (offers) created in the dashboard.
 *
 * - The checkout always re-checks the code and works out the discount on the server (src/lib/promo.ts).
 * - `used_count` counts non-cancelled orders. A use is reserved with a conditional UPDATE before the order is
 *   saved, so two customers can never both take the last use of a limited code.
 * - Orders keep a copy of the rules, so editing or deleting a code never changes an order already placed.
 */
export interface PromoRow {
  id: number;
  code: string;
  type: PromoType;
  value: number;
  min_subtotal: number | null;
  max_discount: number | null;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  per_customer_limit: number | null;
  used_count: number;
  active: number;
  banner: number;
  banner_text: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export const rulesOf = (r: Pick<PromoRow, 'type' | 'value' | 'min_subtotal' | 'max_discount'>): PromoRules => ({
  type: r.type,
  value: r.value,
  minSubtotal: r.min_subtotal,
  maxDiscount: r.type === 'percent' ? r.max_discount : null,
});

/** Where a code stands right now. Paused wins over everything; then expired, used up, not started yet. */
export function promoState(r: PromoRow, now = new Date().toISOString()): PromoState {
  if (!r.active) return 'paused';
  if (r.ends_at && r.ends_at <= now) return 'expired';
  if (r.usage_limit !== null && r.used_count >= r.usage_limit) return 'used_up';
  if (r.starts_at && r.starts_at > now) return 'scheduled';
  return 'active';
}

export const toPublicPromo = (r: PromoRow): PublicPromo => ({
  code: r.code,
  ...rulesOf(r),
  endsAt: r.ends_at,
  bannerText: r.banner_text,
});

/** Customer-facing reasons a code can't be used (the storefront is in English). */
const REFUSAL: Record<Exclude<PromoState, 'active'> | 'unknown', string> = {
  unknown: 'That promo code isn’t valid. Please check it and try again.',
  paused: 'This promo code is no longer available.',
  expired: 'This promo code has expired.',
  used_up: 'This promo code has been fully redeemed.',
  scheduled: 'This promo code isn’t active yet.',
};

/** Wrong codes per visitor before checking is paused (stops guessing codes by trying them one by one). */
export const PROMO_FAIL_LIMIT = 10;
export const PROMO_FAIL_WINDOW = 15 * 60;

export async function findPromoByCode(db: D1Database, raw: unknown): Promise<PromoRow | null> {
  const code = normalisePromoCode(raw);
  if (!PROMO_CODE_RE.test(code)) return null;
  return db.prepare('SELECT * FROM promo_codes WHERE code = ?').bind(code).first<PromoRow>();
}

/** Throws a 400 with code `promo` (shown under the promo field) unless the code can be used right now. */
export function assertUsable(r: PromoRow | null): asserts r is PromoRow {
  if (!r) throw new HttpError(400, REFUSAL.unknown, 'promo');
  const state = promoState(r);
  if (state !== 'active') throw new HttpError(400, REFUSAL[state], 'promo');
}

/** The code announced in the bar at the top of the shop, if it can be used right now. */
export async function bannerPromo(db: D1Database): Promise<PublicPromo | null> {
  const r = await db.prepare('SELECT * FROM promo_codes WHERE banner = 1 AND active = 1 ORDER BY updated_at DESC LIMIT 1').first<PromoRow>();
  return r && promoState(r) === 'active' ? toPublicPromo(r) : null;
}

/** Takes one use of the code. False when it was paused or its last use went in the meantime. */
export async function reservePromoUse(db: D1Database, id: number): Promise<boolean> {
  const res = await db
    .prepare('UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ? AND active = 1 AND (usage_limit IS NULL OR used_count < usage_limit)')
    .bind(id)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

/** Gives a use back (the order failed to save, was cancelled, or the code was removed from it). */
export const releasePromoUse = (db: D1Database, id: number) =>
  db.prepare('UPDATE promo_codes SET used_count = MAX(used_count - 1, 0) WHERE id = ?').bind(id);

/** Takes a use again when a cancelled order is reopened (never refused, like stock). */
export const retakePromoUse = (db: D1Database, id: number) => db.prepare('UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ?').bind(id);

export async function usesByPhone(db: D1Database, id: number, phone: string): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM orders WHERE promo_id = ? AND phone = ? AND status != 'cancelled'")
    .bind(id, phone)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

// ─── Dashboard ──────────────────────────────────────────────────────────────────────────────────

type StatsRow = PromoRow & { s_orders: number; s_discount: number; s_revenue: number };

const toAdminPromo = (r: StatsRow, now: string): AdminPromo => ({
  id: r.id,
  code: r.code,
  ...rulesOf(r),
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  usageLimit: r.usage_limit,
  perCustomerLimit: r.per_customer_limit,
  usedCount: r.used_count,
  active: !!r.active,
  banner: !!r.banner,
  bannerText: r.banner_text,
  note: r.note,
  state: promoState(r, now),
  stats: { orders: r.s_orders ?? 0, discount: r.s_discount ?? 0, revenue: r.s_revenue ?? 0 },
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const STATS_SQL = `
  SELECT p.*, COALESCE(s.orders, 0) AS s_orders, COALESCE(s.discount, 0) AS s_discount, COALESCE(s.revenue, 0) AS s_revenue
  FROM promo_codes p
  LEFT JOIN (
    SELECT promo_id, COUNT(*) AS orders, SUM(COALESCE(discount, 0)) AS discount, SUM(COALESCE(total, 0)) AS revenue
    FROM orders WHERE promo_id IS NOT NULL AND status != 'cancelled' GROUP BY promo_id
  ) s ON s.promo_id = p.id`;

export async function listPromos(db: D1Database): Promise<AdminPromo[]> {
  const { results } = await db.prepare(`${STATS_SQL} ORDER BY p.created_at DESC, p.id DESC`).all<StatsRow>();
  const now = new Date().toISOString();
  return results.map((r) => toAdminPromo(r, now));
}

export async function getAdminPromo(db: D1Database, id: number): Promise<AdminPromo | null> {
  const r = await db.prepare(`${STATS_SQL} WHERE p.id = ?`).bind(id).first<StatsRow>();
  return r ? toAdminPromo(r, new Date().toISOString()) : null;
}

/** Whole number in [min, max], or null when empty. Anything else is refused with `code`. */
function int(v: unknown, code: string, min: number, max: number): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || Math.round(n) < min || Math.round(n) > max) throw new HttpError(400, 'Invalid number', code);
  return Math.round(n);
}

function isoOrNull(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new HttpError(400, 'Invalid date', 'promo_dates');
  return d.toISOString();
}

export interface PromoValues {
  code: string;
  type: PromoType;
  value: number;
  min_subtotal: number | null;
  max_discount: number | null;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  per_customer_limit: number | null;
  active: number;
  banner: number;
  banner_text: string;
  note: string;
}

/** Checks everything the dashboard sends. Error codes map to messages in src/admin/i18n.ts (err.promo_*). */
export function parsePromoInput(b: Partial<AdminPromoInput>): PromoValues {
  const code = normalisePromoCode(b.code);
  if (!PROMO_CODE_RE.test(code)) throw new HttpError(400, 'Invalid code', 'promo_code_invalid');
  const type = b.type as PromoType;
  if (!PROMO_TYPES.includes(type)) throw new HttpError(400, 'Invalid type', 'promo_type');

  let value = 0;
  if (type === 'percent') {
    const v = int(b.value, 'promo_value_percent', 1, 100);
    if (v === null) throw new HttpError(400, 'Invalid percent', 'promo_value_percent');
    value = v;
  } else if (type === 'fixed') {
    const v = int(b.value, 'promo_value_fixed', 1, 1_000_000);
    if (v === null) throw new HttpError(400, 'Invalid amount', 'promo_value_fixed');
    value = v;
  }

  const min = int(b.minSubtotal, 'promo_min', 0, 10_000_000);
  const maxDiscount = type === 'percent' ? int(b.maxDiscount, 'promo_max', 1, 10_000_000) : null;
  const startsAt = isoOrNull(b.startsAt);
  const endsAt = isoOrNull(b.endsAt);
  if (startsAt && endsAt && endsAt <= startsAt) throw new HttpError(400, 'End before start', 'promo_dates');

  return {
    code,
    type,
    value,
    min_subtotal: min === 0 ? null : min,
    max_discount: maxDiscount,
    starts_at: startsAt,
    ends_at: endsAt,
    usage_limit: int(b.usageLimit, 'promo_limit', 1, 1_000_000),
    per_customer_limit: int(b.perCustomerLimit, 'promo_limit', 1, 1000),
    active: b.active === false ? 0 : 1,
    banner: b.banner ? 1 : 0,
    banner_text: str(b.bannerText, 140),
    note: str(b.note, 300),
  };
}

/** Dashboard input for an existing row (PATCH sends only what changed). */
export const inputFromRow = (r: PromoRow): AdminPromoInput => ({
  code: r.code,
  type: r.type,
  value: r.value,
  minSubtotal: r.min_subtotal,
  maxDiscount: r.max_discount,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  usageLimit: r.usage_limit,
  perCustomerLimit: r.per_customer_limit,
  active: !!r.active,
  banner: !!r.banner,
  bannerText: r.banner_text,
  note: r.note,
});

const COLUMNS = ['code', 'type', 'value', 'min_subtotal', 'max_discount', 'starts_at', 'ends_at', 'usage_limit', 'per_customer_limit', 'active', 'banner', 'banner_text', 'note'] as const;

const isUniqueError = (e: unknown) => /UNIQUE/i.test(String((e as Error)?.message ?? e));
const taken = () => new HttpError(409, 'Code already exists', 'promo_code_taken');

/** Only one code is announced in the top bar at a time: turning it on for one turns it off for the others. */
const clearOtherBanners = (db: D1Database, keepId: number) => db.prepare('UPDATE promo_codes SET banner = 0 WHERE banner = 1 AND id != ?').bind(keepId);

export async function createPromo(db: D1Database, v: PromoValues): Promise<number> {
  if (await db.prepare('SELECT 1 AS x FROM promo_codes WHERE code = ?').bind(v.code).first()) throw taken();
  try {
    const stmts = [
      ...(v.banner ? [db.prepare('UPDATE promo_codes SET banner = 0 WHERE banner = 1')] : []),
      db.prepare(`INSERT INTO promo_codes (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map(() => '?').join(', ')})`).bind(...COLUMNS.map((c) => v[c])),
    ];
    await db.batch(stmts);
  } catch (e) {
    if (isUniqueError(e)) throw taken();
    throw e;
  }
  const row = await db.prepare('SELECT id FROM promo_codes WHERE code = ?').bind(v.code).first<{ id: number }>();
  return row!.id;
}

export async function updatePromo(db: D1Database, id: number, v: PromoValues): Promise<void> {
  if (await db.prepare('SELECT 1 AS x FROM promo_codes WHERE code = ? AND id != ?').bind(v.code, id).first()) throw taken();
  try {
    await db.batch([
      ...(v.banner ? [clearOtherBanners(db, id)] : []),
      db
        .prepare(`UPDATE promo_codes SET ${COLUMNS.map((c) => `${c} = ?`).join(', ')}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
        .bind(...COLUMNS.map((c) => v[c]), id),
    ]);
  } catch (e) {
    if (isUniqueError(e)) throw taken();
    throw e;
  }
}
