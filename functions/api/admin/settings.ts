import type { Fn } from '../../../server/env';
import { HttpError, handle, intOrNull, json, readJson, str } from '../../../server/http';
import { parseInstapayLink } from '../../../src/lib/instapay-link';
import { getSettings } from '../../../server/orders';
import type { PaymentSettings } from '../../../src/lib/api-types';

/** GET /api/admin/settings */
export const onRequestGet: Fn = handle(async ({ env }) => json({ settings: await getSettings(env.DB) }));

/** PUT /api/admin/settings — payment details shown to customers, default delivery fee. */
export const onRequestPut: Fn = handle(async ({ request, env }) => {
  const b = await readJson<Partial<PaymentSettings>>(request);
  // Only a real https://ipn.eg/… link is stored (the share text is fine — the link is pulled out of it).
  const rawLink = str(b.instapayLink, 400);
  const instapayLink = rawLink ? parseInstapayLink(rawLink) : '';
  if (instapayLink === null) throw new HttpError(400, 'InstaPay link must start with https://ipn.eg/', 'bad_instapay_link');
  const values: [string, string][] = [
    ['instapay', str(b.instapay, 120)],
    ['instapayLink', instapayLink],
    ['wallet', str(b.wallet, 40)],
    ['walletName', str(b.walletName, 60) || 'Vodafone Cash'],
    ['deliveryFee', String(intOrNull(b.deliveryFee, { max: 100_000 }) ?? '')],
    ['deliveryNote', str(b.deliveryNote, 200)],
  ];
  await env.DB.batch(
    values.map(([k, v]) =>
      env.DB.prepare('INSERT INTO settings (`key`, `value`) VALUES (?, ?) AS incoming ON DUPLICATE KEY UPDATE `value` = incoming.`value`').bind(k, v),
    ),
  );
  return json({ settings: await getSettings(env.DB) });
});
