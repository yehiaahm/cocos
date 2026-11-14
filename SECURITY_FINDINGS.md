# Security Findings — Coco's Resin Art (prioritised)

Assessed 2026-11-13 · source review + local synthetic-data test instance · full detail in [`SECURITY_AUDIT_REPORT.md`](SECURITY_AUDIT_REPORT.md)
Tags: **[C]** confirmed by test · **[R]** confirmed by code review · **[P]** potential / needs validation
Not assessed: live production (Railway/DNS/TLS), Cloudflare runtime, full Google OAuth round-trip, load/DoS.

**Totals:** Critical 0 · High 1 · Medium 3 · Low 9 · Informational 9

> **Update 2026-11-13 — F-01 fixed in code** (`server/node/clientip.ts`, `server/node/server.ts`, `server/http.ts`, `functions/api/auth/login.ts`, `functions/api/admin/login.ts`, `server/clientip.test.ts`). Typecheck clean, 40/40 tests pass, and the bypass no longer works on a local instance behind a simulated appending proxy (429 at attempt 11 with rotating `X-Forwarded-For`/`CF-Connecting-IP`; admin failures capped globally at 30 per 15 min). **Not yet live:** it needs a deploy, and the real client IP being the right-most `X-Forwarded-For` entry on Railway must be checked after deploy (see report §5, F-01). Trade-off: an attacker can lock the owner out of the sign-in form for up to 15 minutes.

> **Update 2026-11-13 — F-02 fixed in code** (`server/accounts.ts` `safeNext`, mirrored in `src/pages/LoginPage.tsx`, 3 new tests). It now rejects control characters and backslashes, then parses the value with `new URL` and requires the same origin. Typecheck clean, 43/43 tests pass. Not yet deployed. The live Google round-trip was still not run.

> **Update 2026-11-13 — F-03 fixed in code** (`server/http.ts`, `server/node/bodystream.ts`, `server/node/server.ts`, `functions/api/orders/[number]/proof.ts`, and the four endpoints that now rate-limit before reading the body). Bodies are capped while streaming (7 MB hard ceiling, tighter per route), with request timeouts. 57/57 tests, typecheck clean, verified on a local instance with 40 MB chunked uploads (413, server stays up). My first version crashed the server on an aborted upload; that was caught in verification and fixed with a regression test. Not yet deployed; Railway capacity and slow-drip timeouts were not tested.

## Do first
| # | Sev | Status | Finding | Where | Fix (one line) |
|---|---|---|---|---|---|
| F-01 | **HIGH** | [C] | Rate limits bypassed by sending any `X-Forwarded-For` / `CF-Connecting-IP` value on the Railway/Node deployment → unlimited admin-password guessing, order and push-notification spam | `server/http.ts:83-87`, `server/node/server.ts:159-163` | Strip client IP headers, use the platform proxy's IP; add an IP-independent limit on the admin credential; set a long random `ADMIN_PASSWORD` |

## Medium
| # | Status | Finding | Where | Fix |
|---|---|---|---|---|
| F-02 | [C]* | Open redirect after Google sign-in: `next=/%09/evil.example` passes `safeNext` and browsers resolve it to `//evil.example` (*logic tested; live Google flow not run) | `server/accounts.ts:129-132`, `functions/api/auth/google/callback.ts:20,37` | Parse with `new URL`, compare origin, reject control chars/backslash |
| F-03 | [R] | Bodies fully buffered before size checks; no body cap on Node server (unauthenticated memory-exhaustion DoS; not load-tested) | `server/http.ts:40-44`, `functions/api/orders/[number]/proof.ts:20-25`, `server/node/server.ts:164-172` | Cap bytes while streaming + check `Content-Length`; rate-limit before parsing |
| F-04 | [C] | Admin sign-out is cosmetic: stateless 14-day cookie stays valid after logout | `server/auth.ts:51-77`, `functions/api/admin/login.ts:21-22` | Server-side session id + revocation, shorter lifetime |

## Low
| # | Status | Finding | Where | Fix |
|---|---|---|---|---|
| F-05 | [C] | No Content-Security-Policy / frame-ancestors | `public/_headers`, `server/node/static.ts:29-35` | Add CSP (clean up inline script/onload in `index.html`) |
| F-06 | [R] | PBKDF2-SHA256 at 100k iterations (< OWASP 600k); min length 8; no common-password check; no rehash on login | `server/accounts.ts:16,76-79` | Per-runtime cost ≥ 600k or scrypt/argon2id on Node; rehash on login; stronger policy |
| F-07 | [C] | Other customer sessions survive a password change | `functions/api/auth/me.ts:40-51` | Delete other `user_sessions` rows on change |
| F-08 | [C] | Account enumeration: `email_taken`, `use_google`, and 8 ms vs 42 ms login timing | `functions/api/auth/register.ts:34-41`, `functions/api/auth/login.ts:35-38` | Uniform messages; dummy hash for unknown users |
| F-09 | [C] | Proof upload trusts client MIME type (HTML stored as `image/png`); payment state changeable on COD/refunded orders | `functions/api/orders/[number]/proof.ts:16,23-33` | Magic-byte check, state guard, sandbox CSP on proof responses |
| F-10 | [C]† | Static server prefix path check: backslash traversal into `dist-server` on Windows hosts (†Windows only; Linux inferred safe) | `server/node/static.ts:49-52,68` | `startsWith(root + path.sep)`; reject `\` |
| F-11 | [P] | Admin-registered push endpoint → server POSTs to any HTTPS URL (SSRF-capable, admin-only) | `functions/api/admin/push.ts:15`, `server/push.ts:52` | Allow-list push-service hosts, block private IPs |
| F-12 | [C] | 7 vulnerable dev dependencies (2 critical, 2 high, 3 moderate); **0 in production deps** | `package.json` (vitest, wrangler/undici, sharp) | `vitest@4.1.12`, `wrangler@4.161.0`, `sharp@0.35.5`; audit in CI |
| F-13 | [R] | Single shared single-factor admin credential, no admin audit trail | `server/auth.ts:28-33` | TOTP/passkey, sign-in alerts, audit log |

## Informational
| # | Observation |
|---|---|
| I-01 | `x-forwarded-host` / `x-forwarded-proto` trusted from any client (affects redirect_uri, `Secure`, origin check) — pin public origin [P] |
| I-02 | No security logging/alerting (failed logins, rate-limit hits, admin actions) |
| I-03 | Header hardening: HSTS lacks `includeSubDomains`/`preload`; XFO `SAMEORIGIN` (use `DENY` for admin); no COOP/CORP. CORS correctly absent |
| I-04 | Order token in URL query (`?t=`), non-constant-time compare (entropy 144-bit, not practically exploitable) |
| I-05 | Single-volume SQLite + proofs, manual backups, no retention/deletion/export; PII in `localStorage` (`coco-customer`) |
| I-06 | `/api/catalog` serves InstaPay/wallet details publicly (likely intended) |
| I-07 | Dead duplicate `node-server/` (not imported) |
| I-08 | Local build uses placeholder `https://www.example.com` for canonical/OG/sitemap — verify Railway sets `VITE_SITE_URL` |
| I-09 | No Dockerfile/CI/IaC present; Railway/Cloudflare console config not reviewed |

## Verified OK (tested)
Parameterised SQL (SQLi payload inert) · server-side pricing (client price/total ignored) · order/proof access needs token · all admin endpoints tried → 401 · mass-assignment ignored · CSRF (cross-origin and `Origin: null` → 403) · no CORS · stored-XSS payloads inert in admin + public pages (real browser) · no secrets in git history, tracked files or bundles · customer logout revokes server-side · generic error messages.

**Precaution:** `.dev.vars` (git-ignored, untracked) holds a real Google OAuth client secret in plaintext. If the whole project *folder* (not just the git repo) was ever zipped or shared, rotate that secret.

**Verdict:** requires security improvements before production at scale — fix F-01 and use a long random admin password first, then F-02/F-03/F-04. This is not a claim that the application is secure.
