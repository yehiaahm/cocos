import { describe, expect, it } from 'vitest';
import { normaliseOrderNumber, statusDates } from './orders';
import { mergeOrders, sanitiseSaved } from '../src/store/myOrders';
import { isOpenOrder } from '../src/lib/order-status';
import { timeAgo } from '../src/lib/format';
import type { AccountOrderSummary } from '../src/lib/api-types';

describe('order number lookup', () => {
  it('accepts CA-1001 in any common spelling', () => {
    for (const v of ['CA-1001', 'ca-1001', ' ca 1001 ', 'CA1001', '1001']) expect(normaliseOrderNumber(v), v).toBe('CA-1001');
  });
  it('rejects things that are not order numbers', () => {
    for (const v of ['', 'abc', "CA-1001'; DROP", '12', 'XX-1001']) expect(normaliseOrderNumber(v), v).toBeNull();
  });
});

describe('status dates on the customer timeline', () => {
  it('uses the status column and keeps the first time each status was reached', () => {
    const d = statusDates('2026-11-01T10:00:00Z', [
      { type: 'status', message: 'x', status: 'confirmed', created_at: '2026-11-01T12:00:00Z' },
      { type: 'status', message: 'x', status: 'in_progress', created_at: '2026-11-02T09:00:00Z' },
      { type: 'status', message: 'x', status: 'confirmed', created_at: '2026-11-03T09:00:00Z' },
      { type: 'payment', message: 'x', status: null, created_at: '2026-11-03T10:00:00Z' },
    ]);
    expect(d).toEqual({ new: '2026-11-01T10:00:00Z', confirmed: '2026-11-01T12:00:00Z', in_progress: '2026-11-02T09:00:00Z' });
  });
  it('reads older events (no status column) from their Arabic text', () => {
    const d = statusDates('2026-11-01T10:00:00Z', [
      { type: 'status', message: 'الحالة: جديد ← مؤكد', created_at: '2026-11-01T12:00:00Z' },
      { type: 'status', message: 'الحالة: مؤكد ← تم الشحن', created_at: '2026-11-02T12:00:00Z' },
    ]);
    expect(d.confirmed).toBe('2026-11-01T12:00:00Z');
    expect(d.shipped).toBe('2026-11-02T12:00:00Z');
  });
});

describe('orders remembered on the device', () => {
  const tok = 'abcdefghijklmnop';
  it('drops malformed entries, de-duplicates and puts the newest first', () => {
    const out = sanitiseSaved([
      { number: 'CA-1001', token: tok, savedAt: 1 },
      { number: 'CA-1002', token: tok, savedAt: 5 },
      { number: 'CA-1001', token: tok, savedAt: 9 },
      { number: 'nope', token: tok, savedAt: 3 },
      { number: 'CA-1003', token: 'x', savedAt: 3 },
      null,
      'junk',
    ]);
    expect(out.map((o) => o.number)).toEqual(['CA-1001', 'CA-1002']);
    expect(sanitiseSaved('not an array')).toEqual([]);
  });
  it('merges device and account orders by number, newest first', () => {
    const o = (number: string, createdAt: string, status: AccountOrderSummary['status'] = 'new'): AccountOrderSummary => ({
      number,
      token: tok,
      status,
      paymentStatus: 'unpaid',
      total: null,
      itemCount: 1,
      image: null,
      createdAt,
      updatedAt: createdAt,
      courier: null,
      trackingNumber: null,
    });
    const merged = mergeOrders([o('CA-1001', '2026-11-01'), o('CA-1002', '2026-11-03')], [o('CA-1001', '2026-11-01', 'shipped')]);
    expect(merged.map((x) => x.number)).toEqual(['CA-1002', 'CA-1001']);
    expect(merged[1].status).toBe('shipped');
  });
  it('treats delivered and cancelled orders as finished', () => {
    expect(isOpenOrder('shipped')).toBe(true);
    expect(isOpenOrder('delivered')).toBe(false);
    expect(isOpenOrder('cancelled')).toBe(false);
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-11-16T12:00:00Z').getTime();
  it('is friendly', () => {
    expect(timeAgo('2026-11-16T11:59:40Z', now)).toBe('just now');
    expect(timeAgo('2026-11-16T11:30:00Z', now)).toBe('30 min ago');
    expect(timeAgo('2026-11-16T09:00:00Z', now)).toBe('3 h ago');
    expect(timeAgo('2026-11-14T12:00:00Z', now)).toBe('2 days ago');
  });
});
