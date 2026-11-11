// Bundles the Node server (server/node/server.ts + the shared API code in functions/ and server/)
// into dist-server/server.mjs for Railway / any Node host.
import { build } from 'esbuild';

await build({
  entryPoints: ['server/node/server.ts'],
  outfile: 'dist-server/server.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  logLevel: 'info',
  // ESM bundles need a real `require` for any CommonJS dependency.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
