# Data, backups and restore (Railway + MySQL)

## Where the data lives

| What | Where | Survives redeploy? |
|---|---|---|
| Orders, customers, accounts, sessions, the catalogue and prices edited in the dashboard, promos, workshops, settings, push subscriptions | **MySQL service** (`DATABASE_URL`) — its own persistent disk, independent of the site service | Yes |
| Uploaded photos (`/media/catalog/…`), payment screenshots | **Volume** on the site service, `/data/uploads` | Yes, if the Volume is attached |
| Session secret + push (VAPID) keys | `/data/secrets.json` on the Volume (or the `SESSION_SECRET` / `VAPID_*` variables) | Yes, if the Volume is attached |
| Database dumps | `/data/backups/cocos-<UTC time>.sql.gz` on the Volume | Yes, if the Volume is attached |

The site service's own disk is wiped on every deploy. `GET /healthz` shows `"persistent": true|false` (is the Volume attached),
`lastBackupAt`, and returns **503** while MySQL is unreachable.

## One-time Railway setup (dashboard)

1. **MySQL service** in the project (New → Database → MySQL).
2. Site service → **Variables**: `DATABASE_URL` = `${{MySQL.MYSQL_URL}}` (pick it with the reference picker so the service name is right).
3. Site service → **Volumes** → New Volume → mount path `/data`.
4. Redeploy; `/healthz` must show `"persistent":true`. Then add `REQUIRE_PERSISTENT_STORAGE=1`
   (never before the Volume exists — the site would refuse to start).

Optional variables: `BACKUP_INTERVAL_HOURS` (default 24), `BACKUP_KEEP` (default 14 dumps), `DATA_DIR` (overrides the mount path),
`ALLOW_FRESH_DATABASE=1` (see "Wrong or empty database" below).

## Backups

* **Automatic**: at start and then hourly the server checks the newest dump; if it is older than `BACKUP_INTERVAL_HOURS` it writes a new one.
  A dump is a gzipped list of `INSERT` statements taken inside a single consistent-snapshot transaction (orders, items and events always
  agree) while the site keeps serving. It is written to a `.partial` file, read back completely, and only then renamed into place.
  The newest `BACKUP_KEEP` are kept. Failures are logged as `[backup] FAILED: …`.
* **Manual, before anything risky** (a new migration, a big edit): in a Railway shell for the site service
  (`railway ssh` with the CLI, or `railway run` locally with the project's variables): `npm run db:dump`
  → `[dump] wrote /data/backups/cocos-….sql.gz`.
* **Railway's own MySQL backups**: if your Railway plan offers volume backups, enable them on the MySQL service as a second, independent copy.

**The dumps live on the site's Volume, not on the MySQL disk**, so they survive losing the MySQL volume — but not losing the site's Volume.
Copy a dump somewhere else (your computer, Drive) regularly, e.g. monthly and before big changes:

```bash
railway ssh                      # shell inside the site service
ls -la /data/backups
# copy the chosen file out with whatever file transfer your Railway plan/CLI offers
```

## Restore

The dump holds data only; the tables come from `migrations/` when the app starts. So:

1. **Point the site at an empty MySQL database** (a new MySQL service, or `DROP DATABASE`/`CREATE DATABASE` on the broken one — only if you
   are sure; look at the file you are about to restore first). Start the site once: it creates the tables
   (set `ALLOW_FRESH_DATABASE=1` for that one start if `/data/backups` already holds dumps, then remove it).
2. In a shell for the site service run (`DATABASE_URL` is already set there):
   ```bash
   npm run db:restore -- /data/backups/cocos-YYYYMMDDTHHMMSSZ.sql.gz
   ```
   It loads everything in one transaction (a bad file changes nothing) and **refuses** if the tables already hold rows.
   Add `--replace` to empty the tables first.
3. Restart the service and check the startup log: `[db] rows: {…}` should match what you expect, and place a test order.

The restore keeps orders' numbers and ids, so the next order continues the sequence (CA-1001, CA-1002, …).

### Wrong or empty database

If the database has never been migrated (new, empty or wrong) but `/data/backups` holds dumps of a real one, the server **refuses to start**:
`Refusing to start from scratch over what may be a lost or wrong database`. Check `DATABASE_URL`, or restore as above, or — only if starting
empty is really intended — set `ALLOW_FRESH_DATABASE=1` for one start and remove it afterwards.

## Safe migrations

* `migrations/NNNN_name.sql` run once each, in order, at start, under a MySQL advisory lock (two instances starting together do not race).
  A migration is recorded only after it fully succeeded.
* **MySQL cannot roll back DDL.** If a migration fails halfway, the server stops with `Migration <file> failed: …`, the half-done changes stay,
  and the file is **not** recorded. So **every migration must be safe to run twice**: `CREATE TABLE IF NOT EXISTS`, `INSERT IGNORE`; put each
  `ALTER TABLE … ADD COLUMN` in its own new file, once. Fix the cause and restart.
* Never edit a released migration; add a new one. Do not `DROP` or `DELETE` in a migration without a manual dump first (`npm run db:dump`).
* `key` is a reserved word: write `` `key` `` in backticks (the `settings` table). Dates are ISO-8601 UTC strings; use `NOW_SQL` / `agoSql()` from `server/sql.ts`.
* Try a new migration on a copy: restore a dump into a local MySQL, `DATABASE_URL=… npm start`, check the log.

## Logs worth knowing

`[storage] files in … persistent: true|false` · `[db] connected to MySQL host:port/db` · `[db] not reachable yet … retrying` (waits up to 90 s) ·
`[db] applied <migration>` · `[db] rows: {…}` (an unexpectedly empty table here is the first sign of a wrong database) · `[backup] wrote …` ·
`[db] connection dropped (…), retrying` · `[fatal] …` (the server stopped on purpose; the message says why).
