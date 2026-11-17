/**
 * Restore a database dump:   node dist-server/restore.mjs <file.sql.gz> [--replace]
 *
 *   DATABASE_URL   the database to load it into (Railway: run it with `railway run` or inside `railway ssh`).
 *
 * The app must have started once against that database so the tables exist. Without --replace the target
 * must be empty (apart from the default settings), so a restore can never silently mix with live data.
 */
import { existsSync } from 'node:fs';
import { restoreDump } from './backup';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const replace = args.includes('--replace');
const url = process.env.DATABASE_URL || process.env.MYSQL_URL;

if (!file || !url) {
  console.error('Usage: DATABASE_URL=mysql://… node dist-server/restore.mjs <file.sql.gz> [--replace]');
  process.exit(2);
}
if (!existsSync(file)) {
  console.error(`No such file: ${file}`);
  process.exit(2);
}
try {
  const { statements } = await restoreDump(url, file, { replace });
  console.log(`[restore] loaded ${statements} statements from ${file}${replace ? ' (tables were emptied first)' : ''}`);
} catch (e) {
  console.error('[restore] FAILED, nothing was changed:', (e as Error).message);
  process.exit(1);
}
