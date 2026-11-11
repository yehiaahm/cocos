import type { Fn } from '../../../server/env';
import { handle, intOrNull, json, readJson, str } from '../../../server/http';
import { getSettings } from '../../../server/orders';
import type { PaymentSettings } from '../../../src/lib/api-types';

/** GET /api/admin/settings */
export const onRequestGet: Fn = handle(async ({ env }) => json({ settings: await getSettings(env.DB) }));

/** PUT /api/admin/settings — payment details shown to customers, default delivery fee. */
export const onRequestPut: Fn = handle(async ({ request, env }) => {
  const b = await readJson<Partial<PaymentSettings>>(request);
  const values: [string, string][] = [
    ['instapay', str(b.instapay, 120)],
    ['wallet', str(b.wallet, 40)],
    ['walletName', str(b.walletName, 60) || 'Vodafone Cash'],
    ['deliveryFee', String(intOrNull(b.deliveryFee, { max: 100_000 }) ?? '')],
    ['deliveryNote', str(b.deliveryNote, 200)],
  ];
  await env.DB.batch(
    values.map(([k, v]) =>
      env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, v),
    ),
  );
  return json({ settings: await getSettings(env.DB) });
});
