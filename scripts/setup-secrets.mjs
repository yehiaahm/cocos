// Creates .dev.vars for local development (admin password, session secret, push keys)
// and prints the same values so they can be added to Cloudflare as secrets.
//   npm run setup:secrets                 → random admin password
//   npm run setup:secrets -- "MyPassword" → your own password
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, '.dev.vars');
if (existsSync(file) && !process.argv.includes('--force')) {
  console.log('.dev.vars already exists — run with --force to regenerate it.');
  process.exit(0);
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pub = publicKey.export({ format: 'jwk' });
const priv = privateKey.export({ format: 'jwk' });
const vapidPublic = b64url(Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]));

const password = process.argv.slice(2).find((a) => !a.startsWith('--')) || b64url(randomBytes(9));
const vars = {
  ADMIN_PASSWORD: password,
  SESSION_SECRET: b64url(randomBytes(32)),
  VAPID_PUBLIC_KEY: vapidPublic,
  VAPID_PRIVATE_KEY: priv.d,
  VAPID_SUBJECT: 'mailto:admin@example.com',
};
await writeFile(file, Object.entries(vars).map(([k, v]) => `${k}="${v}"`).join('\n') + '\n');

console.log(`Wrote .dev.vars (git-ignored).\n\nDashboard password: ${password}\n`);
console.log('For production, add each value as a Cloudflare secret:');
for (const k of Object.keys(vars)) console.log(`  npx wrangler pages secret put ${k}`);
console.log('\n(Set VAPID_SUBJECT to mailto:<your email>. Keep the same VAPID keys forever, or phones must re-enable notifications.)');
