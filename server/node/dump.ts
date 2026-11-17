/**
 * Take a backup right now:   node dist-server/dump.mjs [directory]
 *
 *   DATABASE_URL   the database to dump
 *   directory      defaults to $DATA_DIR/backups (or $RAILWAY_VOLUME_MOUNT_PATH/backups)
 *
 * Run it before anything risky (a migration, a big edit). Restore with dist-server/restore.mjs.
 */
import path from 'node:path';
import { MySqlDb } from './mysql';
import { dumpDatabase } from './backup';

const url = process.env.DATABASE_URL || process.env.MYSQL_URL;
const base = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH;
const dir = process.argv[2] || (base ? path.join(base, 'backups') : '');
if (!url || !dir) {
  console.error('Usage: DATABASE_URL=mysql://… [DATA_DIR=/data] node dist-server/dump.mjs [directory]');
  process.exit(2);
}
const db = new MySqlDb({ url, connectionLimit: 2 });
try {
  const r = await dumpDatabase(db, dir, Number(process.env.BACKUP_KEEP) || 14);
  console.log(`[dump] wrote ${r.file} (${r.rows} rows, ${r.bytes} bytes)`);
} catch (e) {
  console.error('[dump] FAILED:', (e as Error).message);
  process.exitCode = 1;
} finally {
  await db.close();
}
