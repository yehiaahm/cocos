import type { OrderStatus } from './api-types';

/** The five steps a customer sees, in order. "cancelled" is outside the track. */
export const ORDER_STEPS: { id: OrderStatus; label: string; hint: string }[] = [
  { id: 'new', label: 'Received', hint: 'Coco has your order' },
  { id: 'confirmed', label: 'Confirmed', hint: 'Total and delivery agreed' },
  { id: 'in_progress', label: 'Being made', hint: 'Poured and finished by hand' },
  { id: 'shipped', label: 'On its way', hint: 'Out for delivery' },
  { id: 'delivered', label: 'Delivered', hint: 'Enjoy it!' },
];

export const STATUS_STYLE: Record<OrderStatus, { label: string; cls: string }> = {
  new: { label: 'Received', cls: 'bg-[#E6F4F3] text-teal-dark' },
  confirmed: { label: 'Confirmed', cls: 'bg-[#E6F4F3] text-teal-dark' },
  in_progress: { label: 'Being made', cls: 'bg-[#FBF3DC] text-[#7A5C14]' },
  shipped: { label: 'On its way', cls: 'bg-[#FBF3DC] text-[#7A5C14]' },
  delivered: { label: 'Delivered', cls: 'bg-[#E3F1E5] text-[#24622F]' },
  cancelled: { label: 'Cancelled', cls: 'bg-[#F1ECE4] text-muted-2' },
};

/** A one-line, friendly sentence about where the order is. */
export const STATUS_LINE: Record<OrderStatus, string> = {
  new: 'Coco has your order and will confirm it shortly.',
  confirmed: 'Confirmed — Coco is getting started.',
  in_progress: 'Being poured and finished by hand.',
  shipped: 'On its way to you.',
  delivered: 'Delivered. Enjoy it!',
  cancelled: 'This order was cancelled.',
};

/** Still going: not delivered and not cancelled. */
export const isOpenOrder = (s: OrderStatus) => s !== 'delivered' && s !== 'cancelled';

/** 0–4 position on the track (cancelled → -1), for progress bars. */
export const stepIndex = (s: OrderStatus) => ORDER_STEPS.findIndex((x) => x.id === s);
