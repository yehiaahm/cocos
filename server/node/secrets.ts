import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import path from 'node:path';

interface Generated {
  SESSION_SECRET: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
}

/**
 * SESSION_SECRET and the push (VAPID) keys are generated once and kept on the data volume,
 * so the only variable the owner has to set on Railway is ADMIN_PASSWORD.
 * Values set as environment variables always win.
 */
export function loadSecrets(dataDir: string) {
  const file = path.join(dataDir, 'secrets.json');
  let saved: Partial<Generated> = {};
  if (existsSync(file)) saved = JSON.parse(readFileSync(file, 'utf8'));

  if (!saved.SESSION_SECRET || !saved.VAPID_PUBLIC_KEY || !saved.VAPID_PRIVATE_KEY) {
    const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const pub = publicKey.export({ format: 'jwk' });
    const priv = privateKey.export({ format: 'jwk' });
    saved = {
      SESSION_SECRET: saved.SESSION_SECRET ?? randomBytes(32).toString('base64url'),
      VAPID_PUBLIC_KEY:
        saved.VAPID_PUBLIC_KEY ??
        Buffer.concat([Buffer.from([4]), Buffer.from(pub.x!, 'base64url'), Buffer.from(pub.y!, 'base64url')]).toString('base64url'),
      VAPID_PRIVATE_KEY: saved.VAPID_PRIVATE_KEY ?? priv.d!,
    };
    writeFileSync(file, JSON.stringify(saved, null, 2), { mode: 0o600 });
    console.log('[secrets] generated session secret and push keys (stored on the data volume)');
  }

  const env = process.env;
  return {
    ADMIN_PASSWORD: env.ADMIN_PASSWORD ?? '',
    SESSION_SECRET: env.SESSION_SECRET || saved.SESSION_SECRET!,
    VAPID_PUBLIC_KEY: env.VAPID_PUBLIC_KEY || saved.VAPID_PUBLIC_KEY!,
    VAPID_PRIVATE_KEY: env.VAPID_PRIVATE_KEY || saved.VAPID_PRIVATE_KEY!,
    VAPID_SUBJECT: env.VAPID_SUBJECT || 'mailto:admin@example.com',
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID ?? '',
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET ?? '',
  };
}
