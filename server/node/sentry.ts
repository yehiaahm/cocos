// Error monitoring (Sentry) for the Node server. Imported first by server.ts so it is initialised before
// anything else runs. SENTRY_DSN overrides the default project key; SENTRY_DSN="" (empty) turns reporting off.
import * as Sentry from '@sentry/node';

const DEFAULT_DSN = 'https://7ed87e64395b179050a466f84dd063e7@o4512447745818624.ingest.de.sentry.io/4512447896551504';
const dsn = process.env.SENTRY_DSN ?? (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT ? DEFAULT_DSN : '');

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT_NAME || 'production',
    release: process.env.RAILWAY_GIT_COMMIT_SHA,
    serverName: 'cocos-node',
    tracesSampleRate: 0,
  });
}

/** Report an error with a short context label (no request bodies or headers are attached). */
export function reportError(error: unknown, where: string, extra?: Record<string, unknown>): void {
  if (!dsn) return;
  Sentry.withScope((scope) => {
    scope.setTag('where', where);
    if (extra) scope.setContext('details', extra);
    Sentry.captureException(error);
  });
}

/** Wait for queued events to be sent (used on shutdown). */
export async function flushErrors(timeoutMs = 2000): Promise<void> {
  if (dsn) await Sentry.flush(timeoutMs).catch(() => undefined);
}
