import path from 'node:path';

/**
 * Where the FILES live (uploads, secrets.json, database dumps) and whether they survive a redeploy.
 * The database itself is MySQL (DATABASE_URL) and does not depend on this.
 * On Railway the container's own disk is wiped on every deploy; only a mounted Volume (or an explicit DATA_DIR) survives.
 */
export interface Storage {
  dataDir: string;
  persistent: boolean;
  source: 'DATA_DIR' | 'RAILWAY_VOLUME_MOUNT_PATH' | 'default';
}

export function resolveStorage(env: NodeJS.ProcessEnv, projectRoot: string): Storage {
  const source = env.DATA_DIR ? 'DATA_DIR' : env.RAILWAY_VOLUME_MOUNT_PATH ? 'RAILWAY_VOLUME_MOUNT_PATH' : 'default';
  const dir = env.DATA_DIR || env.RAILWAY_VOLUME_MOUNT_PATH || path.join(projectRoot, '.data');
  return { dataDir: path.resolve(dir), persistent: !env.RAILWAY_ENVIRONMENT || source !== 'default', source };
}

export const flag = (v: string | undefined) => /^(1|true|yes|on)$/i.test(v ?? '');

/** True when the operator asked the server to refuse to run (and fail the health check) on throw-away storage. */
export const requirePersistent = (env: NodeJS.ProcessEnv) => flag(env.REQUIRE_PERSISTENT_STORAGE);
