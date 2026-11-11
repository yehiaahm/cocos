import type { Fn } from '../../../../server/env';
import { handle, json } from '../../../../server/http';

/** GET /api/admin/notifications/latest — read by the service worker when a push arrives. */
export const onRequestGet: Fn = handle(async ({ env }) => {
  const n = await env.DB.prepare(
    "SELECT id, title, body, url FROM notifications WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-10 minutes') ORDER BY id DESC LIMIT 1",
  ).first<{ id: number; title: string; body: string; url: string }>();
  return json({ notification: n ?? null });
});
