/** Types shared by the storefront, the admin dashboard and the Cloudflare API. */

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
}
export type CatalogOverrides = Record<string, CatalogOverride>;

export interface PaymentSettings {
  instapay: string;
  wallet: string;
  walletName: string;
  deliveryFee: number | null;
  deliveryNote: string;
}

export interface CreateOrderInput {
  items: { productId: string; variantId: string; qty: number; personalisation?: string }[];
  customer: { name: string; phone: string; city: string; address: string; notes?: string };
  paymentMethod: PaymentMethod;
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
  total: number | null;
  createdAt: string;
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
  createdAt: string;
}

export interface AdminOrder extends AdminOrderSummary {
  token: string;
  address: string;
  notes: string | null;
  adminNotes: string | null;
  subtotal: number | null;
  deliveryFee: number | null;
  hasProof: boolean;
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
}

export interface AdminProduct {
  id: string;
  slug: string;
  name: string;
  category: string;
  categoryName: string;
  image: string;
  variants: number;
  tags: string[];
  price: number | null;
  hidden: boolean;
  soldOut: boolean;
  sold: number;
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
