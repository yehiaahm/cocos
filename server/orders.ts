import type {
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
  created_at: string;
  updated_at: string;
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

export function toPublic(o: OrderRow, items: OrderItemView[]): PublicOrder {
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
    total: o.total,
    createdAt: o.created_at,
  };
}

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
    hasProof: !!o.proof_key,
    items,
    events: ev,
    updatedAt: o.updated_at,
    customerOrderCount: count?.n ?? 1,
  };
}

/** Subtotal is only known when every line has a price; total also needs the delivery fee. */
export function computeTotals(items: { qty: number; unitPrice: number | null }[], deliveryFee: number | null) {
  const priced = items.every((i) => i.unitPrice !== null);
  const subtotal = priced ? items.reduce((t, i) => t + (i.unitPrice ?? 0) * i.qty, 0) : null;
  const total = subtotal !== null && deliveryFee !== null ? subtotal + deliveryFee : null;
  return { subtotal, total };
}

export const DEFAULT_SETTINGS: PaymentSettings = {
  instapay: '',
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

export const addEvent = (db: D1Database, orderId: number, type: string, message: string) =>
  db.prepare('INSERT INTO order_events (order_id, type, message) VALUES (?, ?, ?)').bind(orderId, type, message);
