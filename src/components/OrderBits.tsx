import { Link } from 'react-router';
import type { AccountOrderSummary, OrderStatus } from '../lib/api-types';
import { ORDER_STEPS, STATUS_LINE, STATUS_STYLE, stepIndex } from '../lib/order-status';
import { formatPrice, plural, shortDay, timeAgo } from '../lib/format';
import { imageUrl } from '../lib/images';
import { Truck } from './Icons';

export const orderHref = (o: { number: string; token: string }) => `/order/${o.number}?t=${encodeURIComponent(o.token)}`;

export function StatusPill({ status }: { status: OrderStatus }) {
  const s = STATUS_STYLE[status];
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${s?.cls ?? ''}`}>{s?.label ?? status}</span>;
}

/** Five-segment progress bar: how far the order has got. */
export function MiniTrack({ status }: { status: OrderStatus }) {
  const at = stepIndex(status);
  if (status === 'cancelled') return null;
  return (
    <div role="img" aria-label={`Step ${at + 1} of ${ORDER_STEPS.length}: ${ORDER_STEPS[at]?.label}`} className="flex gap-1.5">
      {ORDER_STEPS.map((s, i) => (
        <span key={s.id} aria-hidden="true" className={`h-1.5 flex-1 rounded-full ${i < at ? 'bg-teal' : i === at ? (status === 'delivered' ? 'bg-teal' : 'bg-gold') : 'bg-line'}`} />
      ))}
    </div>
  );
}

/** One order in "My orders": photo, status, progress, shipment, last update. The whole card opens the order page. */
export function OrderCard({ order: o, onRemove }: { order: AccountOrderSummary; onRemove?: () => void }) {
  return (
    <li className="rounded-[24px] bg-white p-4 shadow-[0_18px_40px_-34px_rgba(11,46,51,.55)] max-[560px]:rounded-[20px]">
      <Link to={orderHref(o)} className="flex flex-col gap-3.5 text-ink no-underline hover:text-ink">
        <span className="flex items-center gap-4">
          {o.image ? (
            <img src={imageUrl(o.image, 320)} alt="" width={64} height={64} className="h-16 w-16 flex-none rounded-xl object-cover" />
          ) : (
            <span className="h-16 w-16 flex-none rounded-xl bg-sand" />
          )}
          <span className="flex min-w-0 flex-1 flex-col">
            <strong className="text-[16px]">{o.number}</strong>
            <span className="text-[13px] text-muted-2">
              {shortDay(o.createdAt)} · {plural(o.itemCount, 'item')} · {o.total !== null ? formatPrice(o.total) : 'Total pending'}
            </span>
          </span>
          <StatusPill status={o.status} />
        </span>
        <MiniTrack status={o.status} />
        <span className="text-[14px] leading-snug text-muted">{STATUS_LINE[o.status]}</span>
        {o.status === 'shipped' && (o.trackingNumber || o.courier) && (
          <span className="inline-flex items-center gap-2 rounded-xl bg-cream px-3 py-2 text-[13px] font-semibold">
            <Truck size={16} />
            <span>
              {o.courier}
              {o.courier && o.trackingNumber ? ' · ' : ''}
              <span dir="ltr">{o.trackingNumber}</span>
            </span>
          </span>
        )}
      </Link>
      <div className="mt-2.5 flex items-center justify-between gap-3 text-[12px] text-muted-2">
        <span>Updated {timeAgo(o.updatedAt)}</span>
        {onRemove && (
          <button type="button" onClick={onRemove} className="min-h-9 cursor-pointer border-0 bg-transparent px-1 text-[12px] font-semibold text-muted-2 underline hover:text-ink">
            Remove from this device
          </button>
        )}
      </div>
    </li>
  );
}
