import type {
  AccountOrderSummary,
  AdminOrder,
  AdminOrderSummary,
  OrderEventView,
  OrderItemView,
  OrderStatus,
  PaymentMethod,
  PaymentSettings,
  PaymentStatus,
  PublicOrder,
} from '../src/lib/api-types';
import { orderTotals, type PromoRules } from '../src/lib/promo';

export interface OrderRow {
  id: number;
  number: string;
  token: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  proof_key: string | null;
  customer_name: string;
  phone: string;
  city: string;
  address: string;
  notes: string | null;
  subtotal: number | null;
  delivery_fee: number | null;
  total: number | null;
  admin_notes: string | null;
  promo_id: number | null;
  promo_code: string | null;
  /** JSON copy of the code's rules when the order was placed. */
  promo: string | null;
  discount: number | null;
  courier: string | null;
  tracking_number: string | null;
  created_at: string;
  updated_at: string;
}

/** The promo rules an order was placed with (its own copy), or null. */
export function promoOf(o: Pick<OrderRow, 'promo'>): PromoRules | null {
  if (!o.promo) return null;
  try {
    const r = JSON.parse(o.promo) as PromoRules;
    return r && typeof r.type === 'string' ? r : null;
  } catch {
    return null;
  }
}

interface ItemRow {
  id: number;
  order_id: number;
  product_id: string;
  variant_id: string;
  name: string;
  variant_name: string | null;
  image: string | null;
  qty: number;
  personalisation: string | null;
  unit_price: number | null;
}

export const STATUS_AR: Record<OrderStatus, string> = {
  new: 'جديد',
  confirmed: 'مؤكد',
  in_progress: 'قيد التنفيذ',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
};
export const PAYMENT_STATUS_AR: Record<PaymentStatus, string> = {
  unpaid: 'لم يُدفع',
  pending_review: 'إيصال بانتظار المراجعة',
  paid: 'مدفوع',
  refunded: 'مسترد',
};

const mapItem = (r: ItemRow): OrderItemView => ({
  id: r.id,
  productId: r.product_id,
  variantId: r.variant_id,
  name: r.name,
  variantName: r.variant_name,
  image: r.image,
  qty: r.qty,
  personalisation: r.personalisation,
  unitPrice: r.unit_price,
});

export async function getOrderRow(db: D1Database, where: { id?: number; number?: string }): Promise<OrderRow | null> {
  if (where.id !== undefined) return db.prepare('SELECT * FROM orders WHERE id = ?').bind(where.id).first<OrderRow>();
  return db.prepare('SELECT * FROM orders WHERE number = ?').bind(where.number ?? '').first<OrderRow>();
}

export async function getItems(db: D1Database, orderId: number): Promise<OrderItemView[]> {
  const { results } = await db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').bind(orderId).all<ItemRow>();
  return results.map(mapItem);
}

const STATUS_BY_AR = Object.fromEntries(Object.entries(STATUS_AR).map(([k, v]) => [v, k])) as Record<string, OrderStatus>;

/**
 * When the order first reached each status, from its timeline. Events written before the `status` column existed
 * are read from their Arabic text ("الحالة: جديد ← مؤكد"), so old orders keep their dates.
 */
export function statusDates(
  createdAt: string,
  events: { type: string; message: string; status?: string | null; created_at: string }[],
): Partial<Record<OrderStatus, string>> {
  const out: Partial<Record<OrderStatus, string>> = { new: createdAt };
  for (const e of [...events].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0))) {
    if (e.type !== 'status') continue;
    const to = (e.status as OrderStatus | null | undefined) ?? STATUS_BY_AR[/←\s*(.+)$/.exec(e.message)?.[1]?.trim() ?? ''];
    if (to && !out[to]) out[to] = e.created_at;
  }
  return out;
}

/** "ca-1001", "1001" and " CA-1001 " all mean CA-1001. */
export function normaliseOrderNumber(input: string): string | null {
  const m = /^(?:CA)?[\s-]*(\d{4,8})$/i.exec(input.trim());
  return m ? `CA-${m[1]}` : null;
}

export async function getStatusDates(db: D1Database, o: Pick<OrderRow, 'id' | 'created_at'>) {
  const { results } = await db
    .prepare("SELECT type, message, status, created_at FROM order_events WHERE order_id = ? AND type = 'status'")
    .bind(o.id)
    .all<{ type: string; message: string; status: string | null; created_at: string }>();
  return statusDates(o.created_at, results);
}

export function toPublic(o: OrderRow, items: OrderItemView[], dates: Partial<Record<OrderStatus, string>> = { new: o.created_at }): PublicOrder {
  return {
    number: o.number,
    status: o.status,
    paymentMethod: o.payment_method,
    paymentStatus: o.payment_status,
    hasProof: !!o.proof_key,
    customerName: o.customer_name,
    city: o.city,
    items,
    subtotal: o.subtotal,
    deliveryFee: o.delivery_fee,
    promoCode: o.promo_code,
    discount: o.promo_code ? o.discount : 0,
    total: o.total,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    courier: o.courier,
    trackingNumber: o.tracking_number,
    statusDates: dates,
  };
}

/** What "My orders" shows for one order: status, total, first photo, shipment. Also used by the signed-in account list. */
export const TRACKED_SELECT = `SELECT o.number, o.token, o.status, o.payment_status, o.total, o.created_at, o.updated_at, o.courier, o.tracking_number,
            (SELECT COALESCE(SUM(qty), 0) FROM order_items WHERE order_id = o.id) AS item_count,
            (SELECT image FROM order_items WHERE order_id = o.id ORDER BY id LIMIT 1) AS image
     FROM orders o`;

export interface TrackedRow {
  number: string;
  token: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  total: number | null;
  created_at: string;
  updated_at: string;
  courier: string | null;
  tracking_number: string | null;
  item_count: number;
  image: string | null;
}

export const toTracked = (r: TrackedRow): AccountOrderSummary => ({
  number: r.number,
  token: r.token,
  status: r.status,
  paymentStatus: r.payment_status,
  total: r.total,
  itemCount: r.item_count,
  image: r.image,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  courier: r.courier,
  trackingNumber: r.tracking_number,
});

export function toSummary(o: OrderRow & { item_count?: number }): AdminOrderSummary {
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    paymentMethod: o.payment_method,
    paymentStatus: o.payment_status,
    customerName: o.customer_name,
    phone: o.phone,
    city: o.city,
    itemCount: o.item_count ?? 0,
    total: o.total,
    promoCode: o.promo_code ?? null,
    createdAt: o.created_at,
  };
}

export async function toAdmin(db: D1Database, o: OrderRow): Promise<AdminOrder> {
  const [items, events, count] = await Promise.all([
    getItems(db, o.id),
    db
      .prepare('SELECT id, type, message, created_at FROM order_events WHERE order_id = ? ORDER BY id DESC')
      .bind(o.id)
      .all<{ id: number; type: string; message: string; created_at: string }>(),
    db.prepare("SELECT COUNT(*) AS n FROM orders WHERE phone = ? AND status != 'cancelled'").bind(o.phone).first<{ n: number }>(),
  ]);
  const ev: OrderEventView[] = events.results.map((e) => ({ id: e.id, type: e.type, message: e.message, createdAt: e.created_at }));
  return {
    ...toSummary({ ...o, item_count: items.reduce((t, i) => t + i.qty, 0) }),
    token: o.token,
    address: o.address,
    notes: o.notes,
    adminNotes: o.admin_notes,
    subtotal: o.subtotal,
    deliveryFee: o.delivery_fee,
    discount: o.promo_code ? o.discount : 0,
    promo: promoOf(o),
    hasProof: !!o.proof_key,
    courier: o.courier,
    trackingNumber: o.tracking_number,
    items,
    events: ev,
    updatedAt: o.updated_at,
    customerOrderCount: count?.n ?? 1,
  };
}

/**
 * Subtotal is only known when every line has a price; the total also needs the delivery fee and — with a
 * promo code — the discount (see src/lib/promo.ts, shared with the storefront).
 */
export const computeTotals = (items: { qty: number; unitPrice: number | null }[], deliveryFee: number | null, promo?: PromoRules | null) =>
  orderTotals(items, deliveryFee, promo);

export const DEFAULT_SETTINGS: PaymentSettings = {
  instapay: '',
  instapayLink: '',
  wallet: '',
  walletName: 'Vodafone Cash',
  deliveryFee: null,
  deliveryNote: 'Delivery across Egypt — fee confirmed with your total.',
};

export async function getSettings(db: D1Database): Promise<PaymentSettings> {
  const { results } = await db.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>();
  const s: PaymentSettings = { ...DEFAULT_SETTINGS };
  for (const { key, value } of results) {
    if (key === 'deliveryFee') s.deliveryFee = value === '' ? null : Number(value);
    else if (key in s) (s as unknown as Record<string, string>)[key] = value;
  }
  return s;
}

/** `status` is only for type 'status' events: the status the order moved to. */
export const addEvent = (db: D1Database, orderId: number, type: string, message: string, status: OrderStatus | null = null) =>
  db.prepare('INSERT INTO order_events (order_id, type, message, status) VALUES (?, ?, ?, ?)').bind(orderId, type, message, status);
