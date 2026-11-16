/** Types shared by the storefront, the admin dashboard and the Cloudflare API. */

import type { PromoRules, PromoType } from './promo';

export type OrderStatus = 'new' | 'confirmed' | 'in_progress' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentMethod = 'cod' | 'instapay' | 'wallet';
export type PaymentStatus = 'unpaid' | 'pending_review' | 'paid' | 'refunded';

export const ORDER_STATUSES: OrderStatus[] = ['new', 'confirmed', 'in_progress', 'shipped', 'delivered', 'cancelled'];
export const PAYMENT_METHODS: PaymentMethod[] = ['cod', 'instapay', 'wallet'];
export const PAYMENT_STATUSES: PaymentStatus[] = ['unpaid', 'pending_review', 'paid', 'refunded'];

export interface CatalogOverride {
  price: number | null;
  hidden: boolean;
  soldOut: boolean;
  /** Units in stock; null = not tracked. Only the dashboard gets it; the public catalogue folds 0 into soldOut. */
  stock?: number | null;
}
export type CatalogOverrides = Record<string, CatalogOverride>;

export interface PaymentSettings {
  instapay: string;
  /** Optional ipn.eg payment link from the InstaPay app; opens the send-money screen. */
  instapayLink: string;
  wallet: string;
  walletName: string;
  deliveryFee: number | null;
  deliveryNote: string;
}

/** A signed-in customer (GET /api/auth/me). */
export interface AccountUser {
  id: number;
  email: string;
  name: string;
  avatarUrl: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
  hasPassword: boolean;
  google: boolean;
  createdAt: string;
}

export interface AuthMe {
  user: AccountUser | null;
  /** Whether "Continue with Google" is configured on the server. */
  google: boolean;
}

export interface AccountOrderSummary {
  number: string;
  token: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number | null;
  itemCount: number;
  image: string | null;
  createdAt: string;
  /** Last change (status, payment, price or shipment details) — "updated 2 h ago" on the My orders page. */
  updatedAt: string;
  courier: string | null;
  trackingNumber: string | null;
}

export interface CreateOrderInput {
  items: { productId: string; variantId: string; qty: number; personalisation?: string }[];
  customer: { name: string; phone: string; city: string; address: string; notes?: string };
  paymentMethod: PaymentMethod;
  /** Optional promo code; the server checks it again and works out the discount itself. */
  promoCode?: string;
  /** Honeypot — must stay empty. */
  website?: string;
}

export interface OrderItemView {
  id: number;
  productId: string;
  variantId: string;
  name: string;
  variantName: string | null;
  image: string | null;
  qty: number;
  personalisation: string | null;
  unitPrice: number | null;
}

export interface OrderEventView {
  id: number;
  type: string;
  message: string;
  createdAt: string;
}

/** What the customer sees on their order page. */
export interface PublicOrder {
  number: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  hasProof: boolean;
  customerName: string;
  city: string;
  items: OrderItemView[];
  subtotal: number | null;
  deliveryFee: number | null;
  /** Promo code used on the order, if any. */
  promoCode: string | null;
  /** EGP taken off; null while it can't be worked out yet (unpriced items), 0 without a code. */
  discount: number | null;
  total: number | null;
  createdAt: string;
  updatedAt: string;
  /** Shipment details, set by Coco when the order ships. */
  courier: string | null;
  trackingNumber: string | null;
  /** When the order first reached each status (the customer's timeline dates). */
  statusDates: Partial<Record<OrderStatus, string>>;
}

export interface AdminOrderSummary {
  id: number;
  number: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  customerName: string;
  phone: string;
  city: string;
  itemCount: number;
  total: number | null;
  promoCode: string | null;
  createdAt: string;
}

export interface AdminOrder extends AdminOrderSummary {
  token: string;
  address: string;
  notes: string | null;
  adminNotes: string | null;
  subtotal: number | null;
  deliveryFee: number | null;
  discount: number | null;
  /** The rules the order was placed with (a copy: later edits to the code don't change it). */
  promo: PromoRules | null;
  hasProof: boolean;
  courier: string | null;
  trackingNumber: string | null;
  items: OrderItemView[];
  events: OrderEventView[];
  updatedAt: string;
  customerOrderCount: number;
}

export interface AdminOrderUpdate {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  deliveryFee?: number | null;
  items?: { id: number; unitPrice: number | null }[];
  adminNotes?: string;
  courier?: string | null;
  trackingNumber?: string | null;
  /** Takes the promo code off the order (its use goes back to the code) and recomputes the total. */
  removePromo?: boolean;
}

export interface AdminVariant {
  catalogId: string;
  name: string;
  material: string;
  images: string[];
}

export interface AdminProduct {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  categoryName: string;
  image: string;
  variants: AdminVariant[];
  tags: string[];
  price: number | null;
  hidden: boolean;
  soldOut: boolean;
  /** Units in stock; null = not tracked. */
  stock: number | null;
  sold: number;
}

/** A shop category as listed in data/products.json (empty ones included), with its Arabic name. */
export interface AdminCategory {
  slug: string;
  name: string;
  nameAr: string;
  description?: string;
  /** Number of products inside (only in GET /api/admin/categories). */
  count?: number;
}

export interface AdminStats {
  range: number;
  kpis: {
    orders: number;
    ordersPrev: number;
    revenue: number;
    revenuePrev: number;
    paidRevenue: number;
    avgOrder: number | null;
    newOrders: number;
    awaitingPrice: number;
    proofsToReview: number;
    customers: number;
    returningCustomers: number;
  };
  daily: { date: string; orders: number; revenue: number }[];
  statuses: { status: OrderStatus; count: number }[];
  payments: { method: PaymentMethod; count: number }[];
  topProducts: { productId: string; name: string; image: string | null; qty: number; revenue: number }[];
  cities: { city: string; count: number }[];
  pricedProducts: number;
  totalProducts: number;
}

export interface AdminCustomer {
  phone: string;
  name: string;
  city: string;
  orders: number;
  spent: number;
  firstOrder: string;
  lastOrder: string;
  lastOrderNumber: string;
}

/** A promo code as the shop sees it: enough to show it and work out the discount, nothing internal. */
export interface PublicPromo extends PromoRules {
  code: string;
  /** ISO; null = no end date. */
  endsAt: string | null;
  /** The owner's own announcement for the top bar ('' = generated from the rules). */
  bannerText: string;
}

export type PromoState = 'active' | 'scheduled' | 'expired' | 'used_up' | 'paused';

export interface AdminPromo extends PromoRules {
  id: number;
  code: string;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  usedCount: number;
  active: boolean;
  banner: boolean;
  bannerText: string;
  note: string;
  state: PromoState;
  /** Results from non-cancelled orders that used the code. */
  stats: { orders: number; discount: number; revenue: number };
  createdAt: string;
  updatedAt: string;
}

/** Body of POST /api/admin/promos and PATCH /api/admin/promos/:id (PATCH may send only some fields). */
export interface AdminPromoInput {
  code: string;
  type: PromoType;
  value: number | null;
  minSubtotal: number | null;
  maxDiscount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  active: boolean;
  banner: boolean;
  bannerText: string;
  note: string;
}
