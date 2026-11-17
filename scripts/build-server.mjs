// Bundles the Node server (server/node/server.ts + the shared API code in functions/ and server/)
// into dist-server/server.mjs for Railway / any Node host, and the backup tools into dist-server/dump.mjs and dist-server/restore.mjs.
import { build } from 'esbuild';

await build({
  entryPoints: { server: 'server/node/server.ts', restore: 'server/node/restore.ts', dump: 'server/node/dump.ts' },
  outdir: 'dist-server',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  // Loaded from node_modules at runtime: the Sentry SDK (and OpenTelemetry under it) must not be bundled.
  external: ['@sentry/node'],
  logLevel: 'info',
  // ESM bundles need a real `require` for any CommonJS dependency.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
