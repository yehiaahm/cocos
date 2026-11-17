// Error monitoring (Sentry) for the storefront and the admin dashboard.
// The DSN is a public, write-only key (it is meant to ship in client bundles); VITE_SENTRY_DSN overrides it.
import * as Sentry from '@sentry/react';

const DSN =
  import.meta.env.VITE_SENTRY_DSN ||
  'https://7ed87e64395b179050a466f84dd063e7@o4512447745818624.ingest.de.sentry.io/4512447896551504';

if (import.meta.env.PROD && typeof window !== 'undefined' && DSN) {
  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || 'production',
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    // Noise from extensions, in-app browsers and flaky mobile networks.
    ignoreErrors: ['ResizeObserver loop', 'Non-Error promise rejection captured', /^Load failed$/, /Failed to fetch dynamically imported module/],
    denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-web-extension:\/\//],
  });
}

export { Sentry };
