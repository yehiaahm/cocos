# Security Assessment Report — Coco's Resin Art

| | |
|---|---|
| **Date** | 2026-11-13 |
| **Target** | `D:\projectes\cocos-art-handoff\cocos-art-handoff` (git `main`, HEAD `526fa6a`) |
| **Assessment type** | White-box source review + local DAST against a throw-away instance |
| **Methodology** | OWASP WSTG / ASVS (L1–L2 areas), OWASP Top 10 (2021), OWASP API Top 10 (2023) |
| **Source modified?** | No. The only files written are this report, `SECURITY_FINDINGS.md`, and scratch files outside the project. |

---

## 1. Executive Summary

**Overall assessment: requires security improvements before the shop is exposed to real traffic at scale. It is not a "not ready" application.** The code base is small, readable and shows genuine security care: parameterised SQL everywhere, server-side pricing, hashed session tokens, PKCE + `state` on Google sign-in, honeypots, same-origin checks, per-endpoint rate limits, `HttpOnly`/`SameSite` cookies, and no `dangerouslySetInnerHTML` anywhere. Hostile input rendered in the admin dashboard was tested in a real browser and did not execute (§6).

The main weakness is a **deployment-specific one**. The shop runs on a Node server on Railway, and every rate limit trusts a client-supplied IP header (`CF-Connecting-IP` / `X-Forwarded-For`). On Cloudflare that header is trustworthy. On Railway the client controls it. Anyone can therefore reset every rate limit by changing one header (**F-01, confirmed**). That removes the only brute-force protection on the single, shared, single-factor **admin password**, and it lets bots flood the owner's phone with fake orders.

| Overall risk rating | **MEDIUM-HIGH** (one High, three Medium, no Critical) |
|---|---|

### Most critical findings
1. **F-01 (High)**: rate limiting is bypassable, so the admin password can be guessed without limit.
2. **F-02 (Medium)**: post-login open redirect through a TAB character in `next`.
3. **F-03 (Medium)**: request bodies are buffered in full before size checks, so a single unauthenticated client can exhaust memory on the container.
4. **F-04 (Medium)**: admin sign-out does nothing server-side; a copied admin cookie stays valid for 14 days.

### Main business risks
- Takeover of the owner dashboard, which holds customer names, phones, addresses and payment screenshots.
- Order/notification spam that hides real orders and wears out the owner's phone alerts.
- Loss of availability through memory exhaustion on a single-instance host.
- Customer redirection to a look-alike site right after a legitimate Google sign-in.

### Not covered / honest limits
Production was **not** touched. The production URL and credentials were not provided, and testing live systems requires your explicit approval. The Cloudflare Workers runtime was not exercised (only the Node/Railway runtime). The full Google OAuth round-trip was not executed. No load or DoS tests were run. Details are in §2.4.

---

## 2. Scope, Architecture & Methodology

### 2.1 Technology stack (Phase 1)
| Layer | Technology |
|---|---|
| Frontend | React 19, React Router 7, Zustand 5, Tailwind 4, Vite 7, prerendered to static HTML (`scripts/prerender.mjs`) |
| API | "Pages Functions" style handlers in `functions/**` (Cloudflare Pages Functions API) sharing code in `server/**` |
| Runtime A (production per project notes) | Node ≥ 22.13 server (`server/node/server.ts`, bundled to `dist-server/server.mjs`) on **Railway**; SQLite via `node:sqlite` emulating the D1 API; uploads on a volume via a file-based R2 emulation |
| Runtime B (supported, not live) | Cloudflare Pages + D1 + R2 (`wrangler.toml`, placeholder `database_id`) |
| Auth | (1) Admin: one shared `ADMIN_EMAIL` + `ADMIN_PASSWORD`, stateless HMAC-signed cookie. (2) Customers: email + password (PBKDF2) or Google OAuth, opaque session token (hash stored). |
| Third parties | Google OAuth (`accounts.google.com`, `oauth2.googleapis.com`), Google Fonts, Web-Push services (FCM / Mozilla / Apple) |
| CI/CD / Docker / IaC | **None present** (no Dockerfile, no `.github`, no Terraform). Railway builds with `npm run build` (`railway.json`). |

### 2.2 Architecture (data flows)
```
Browser ──HTTPS──▶ Railway proxy ──▶ Node server.ts ─┬─▶ static dist/ (prerendered pages, SPA shells)
                                                      ├─▶ /api/* handlers (functions/**)
                                                      │      ├─ SQLite (cocos.db on volume): orders, users, sessions, rate_limits…
                                                      │      └─ uploads/ on volume: payment proofs
                                                      └─▶ outbound: Google token endpoint, Web-Push endpoints
```

### 2.3 Phases and what was done
| Phase | Activities |
|---|---|
| 1 Discovery | File inventory (129 tracked non-image files), stack and architecture mapping |
| 2 Source/config review | Manual review of **all** of `server/**`, `functions/**`, `migrations/**`, `public/_headers`, `public/admin-sw.js`, `wrangler.toml`, `railway.json`, `vercel.json`, `netlify.toml`, `scripts/**` (security-relevant ones), `index.html`, `src/lib/{seo,phone}`, `src/store/{auth,cart}`, `src/admin/{api,format}`, `src/pages/{OrderPage,LoginPage}` |
| 3 Identification | Pattern search for XSS/redirect/storage/eval sinks across `src/`; SQL construction review; authz matrix; business-logic review |
| 4 Validation | Local instance on synthetic data/credentials (scratch DB): roughly 200 HTTP requests across 11 test groups, a real-browser XSS check (built-in browser, localhost only), logic harness for `safeNext` |
| 5–7 | Risk rating, this report, remediation roadmap |

SAST was manual (no commercial scanner available). SCA used `npm audit` against the lock file (the dependency list was sent to the npm registry, which is how `npm audit` works). Secret scanning used pattern search over tracked files and the full git history, plus bundle inspection.

### 2.4 Items not reviewed, and why
| Item | Reason |
|---|---|
| `node_modules/`, `dist/`, `dist-server/`, `.wrangler/` | Third-party or generated output. `dist` and `dist-server` were checked for embedded secrets (none) and source maps (none in `dist`). |
| `public/images/**`, `dist/images/**`, `brand/**` | Binary images. |
| `data/*.json`, `data/catalog-review.xlsx`, `design-reference/*.html` | Product data and static design mock-ups; not served by the app (not present in `dist`). Not read line by line. |
| `src/components/**`, `src/pages/{Home,Shop,Product,Checkout,Account,Privacy,NotFound}Page.tsx`, `src/admin/pages/**`, `src/main.tsx`, `src/App.tsx`, `src/entry-server.tsx` | Presentational code. Covered by targeted sink searches (`dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `document.write`, `window.open`, URL building, storage, `fetch`) rather than line-by-line review. The browser XSS test exercised the admin order, list and customer pages and the public order page. |
| `*.test.ts(x)`, `PROMPT_FOR_CLAUDE_CODE.md`, `HANDOFF.md`, `README.md` | Tests and docs. Docs grepped for secrets (none). README used for deployment context. |
| `node-server/` | Dead duplicate (not imported by anything). See I-07. |
| Production Railway/Cloudflare console, DNS, TLS, headers at the edge | No access and no authorization to test; not assessed. |
| Cloudflare Workers runtime behaviour, Linux behaviour of the Node server | Local instance ran on Windows with Node 25.2.1. Linux/Workers conclusions are stated as inferred where relevant. |

---

## 3. Security Assessment Matrix

| Severity | Count | IDs |
|---|---:|---|
| **Critical** | 0 | none |
| **High** | 1 | F-01 |
| **Medium** | 3 | F-02, F-03, F-04 |
| **Low** | 9 | F-05 … F-13 |
| **Informational** | 9 | I-01 … I-09 |
| **Total** | **22** | |

Each finding is tagged **[C]** confirmed by test, **[R]** confirmed by code review, or **[P]** potential / inferred.

CVSS note: scores below are **manual estimates** using CVSS v4.0 metrics, not output from the official FIRST calculator. Treat them as indicative bands and re-score with the calculator before using them in a formal record.

---

## 4. Attack Surface Analysis

### 4.1 API endpoints
| Method & path | Auth | Protections observed |
|---|---|---|
| `GET /api/catalog` | none | public, 30 s edge cache. Returns prices **and** InstaPay / wallet details (I-06) |
| `POST /api/orders` | none (optional customer session) | origin check, honeypot, **IP-hash rate limit 6 / 15 min (bypassable, F-01)**, server-side pricing, qty ≤ 99, ≤ 40 lines |
| `GET /api/orders/:number?t=` | order token | 404 on mismatch; token 144-bit |
| `POST /api/orders/:number/proof?t=` | order token | origin check, MIME allow-list (client-declared), 6 MB, 10 / h (bypassable) |
| `POST /api/auth/register` | none | origin check, honeypot, 6 / h (bypassable), length ≥ 8 |
| `POST /api/auth/login` | none | origin check, 10 / 15 min (bypassable). **Also the owner's admin sign-in** |
| `DELETE /api/auth/login` | user cookie | origin check; deletes session row |
| `GET`/`PATCH /api/auth/me` | user cookie (GET public → `user:null`) | origin check on PATCH, whitelisted fields |
| `GET /api/auth/google`, `/callback` | none | PKCE S256, `state` cookie, 10-minute cookie, `safeNext` (F-02) |
| `GET /api/account/orders` | user cookie | scoped by `user_id` (returns the user's own order tokens) |
| `POST /api/admin/login`, `DELETE` | none (login public in middleware) | origin check, 8 / 15 min (bypassable) |
| `GET /api/admin/me`, `/orders`, `/orders/:id`, `/orders/:id/proof`, `/products`, `/stats`, `/customers`, `/settings`, `/notifications/latest` | admin cookie | middleware: HMAC session verify + origin check; verified **401 unauthenticated** |
| `PATCH /api/admin/orders/:id`, `PUT /api/admin/products`, `PUT /api/admin/settings`, `POST`/`PUT`/`DELETE /api/admin/push` | admin cookie | same; whitelisted fields; integer bounds |

### 4.2 Authentication entry points
`POST /api/auth/login` (customers **and** owner), `POST /api/admin/login`, `POST /api/auth/register`, `GET /api/auth/google` → Google → `/api/auth/google/callback`. There is no password-reset or email-verification flow, so no reset-flow vulnerabilities exist.

### 4.3 Admin routes
`/admin`, `/admin/*` (shell served to anyone, as expected for a SPA; data requires the cookie), `/api/admin/*`, `/admin-sw.js` (service worker for push).

### 4.4 Publicly accessible resources
Prerendered pages, `/assets/*`, `/images/*`, manifests, `sitemap.xml`, `robots.txt`, `/healthz`, `/order/*` (shell; data needs the token), `/admin-sw.js`.

### 4.5 Sensitive data flows
| Data | Where it goes | Notes |
|---|---|---|
| Customer name, phone, city, address, notes | `orders`, `users` tables; admin pages; push notification (name + city only) | plaintext in SQLite; no deletion/export feature (I-05) |
| Payment screenshots | `uploads/proofs/<orderId>/…` on volume | served only to admin; content type from client (F-09) |
| Admin credential | env var `ADMIN_PASSWORD` (plaintext compare via HMAC) | single factor (F-13) |
| Session secret / VAPID keys | `secrets.json` on the volume, mode 0600 | fine; volume must be protected |
| Customer password hashes | `users.password_hash` | PBKDF2-SHA256 100k (F-06) |
| Google ID token | server-side only, from Google over TLS | signature not re-verified; acceptable per Google docs (I-01 note) |

---

## 5. Technical Findings

Legend: **[C]** confirmed by dynamic test, **[R]** confirmed by code review, **[P]** potential, needs validation.

---

### F-01 — Rate limiting is bypassable by spoofing IP headers → unlimited admin-password guessing and order spam
- **Severity:** HIGH  **Status:** [C] — **FIXED IN CODE 2026-11-13, pending deploy and a production check** (see "Fix applied" at the end of this finding)
- **CVSS 4.0 (estimate):** `AV:N/AC:L/AT:P/PR:N/UI:N/VC:H/VI:H/VA:L/SC:N/SI:N/SA:N` ≈ **8.0–8.8**. Falls to roughly 5–6 if the admin password is long and random.
- **Affected:** [`server/http.ts:83-87`](server/http.ts:83) (`ipHash`), used by [`functions/api/auth/login.ts:19`](functions/api/auth/login.ts:19), [`functions/api/admin/login.ts:12`](functions/api/admin/login.ts:12), [`functions/api/orders/index.ts:18`](functions/api/orders/index.ts:18), [`functions/api/auth/register.ts:20`](functions/api/auth/register.ts:20), [`functions/api/orders/[number]/proof.ts:18`](functions/api/orders/[number]/proof.ts:18). Header passthrough: [`server/node/server.ts:159-163`](server/node/server.ts:159).
- **Endpoint:** `POST /api/auth/login`, `/api/admin/login`, `/api/auth/register`, `POST /api/orders`, `/api/orders/:n/proof`
- **Explanation:** `ipHash` builds the rate-limit bucket from `cf-connecting-ip ?? x-forwarded-for ?? 'local'`. Cloudflare overwrites `cf-connecting-ip`, so this is safe on Cloudflare. On the Railway/Node deployment, `toRequest()` copies **all** client headers into the `Request`, and nothing strips or validates them. A client that sends `X-Forwarded-For: <anything>` or `CF-Connecting-IP: <anything>` gets a fresh bucket for each distinct value.
- **Root cause:** Trusting client-controlled forwarding headers as the identity for throttling, and sharing one code path between a platform that sanitises them (Cloudflare) and one that does not (Node).
- **Attack scenario:** An attacker loops over the owner's email with a password list, changing `X-Forwarded-For` on every request. Throttling never triggers, and the shared admin password is eventually guessed. Separately, a bot posts hundreds of fake orders. Each one writes rows and fires a push notification to the owner's phones.
- **Business impact:** Full dashboard takeover (customer PII, payment proofs, ability to mark orders paid or change prices and payment details). Order/notification flooding hides real orders.
- **Evidence (local test, `dast.mjs` T3/T7):**
  - Fixed client IP: first `429` at attempt **11** (limit works).
  - 40 logins with rotating `X-Forwarded-For`: **40 × 401, zero 429**.
  - 40 admin-email logins with wrong passwords and rotating `CF-Connecting-IP`: **40 × 401, zero 429**, then the correct password logs in.
  - 12 orders with rotating header: **12 × 201**. 9 orders from one fixed IP: 6 × 201, 3 × 429.
- **Safe reproduction (local synthetic instance only):**
  ```bash
  PORT=3999 DATA_DIR=./scratch ADMIN_EMAIL=owner@test.invalid ADMIN_PASSWORD='synthetic' node dist-server/server.mjs
  for i in $(seq 1 40); do curl -s -o /dev/null -w "%{http_code} " -X POST localhost:3999/api/auth/login \
    -H 'content-type: application/json' -H "x-forwarded-for: 203.0.113.$i" \
    -d '{"email":"owner@test.invalid","password":"wrong"}'; done   # → 401 ×40, never 429
  ```
- **Remediation:**
  1. Derive the client IP only from a source you control. On Node, take it from the proxy hop appended by Railway (rightmost trusted `X-Forwarded-For` entry; confirm against Railway's docs for your setup) or the socket address, and **drop any client-supplied `cf-connecting-ip` / `x-forwarded-for`** before building the `Request`.
  2. Add limits that do not depend on IP: a global bucket on the admin credential (e.g. 20 failures / 15 min across all sources) and a per-email bucket, with exponential back-off.
  3. Strengthen the admin credential (F-13).
  ```ts
  // server/node/server.ts — in toRequest(): never forward client-supplied identity headers
  headers.delete('cf-connecting-ip'); headers.delete('x-forwarded-for');
  const trusted = String(req.headers['x-forwarded-for'] ?? '').split(',').map(s => s.trim()).filter(Boolean).at(-1)
                  ?? req.socket.remoteAddress ?? 'local';   // rightmost = appended by the platform proxy
  headers.set('x-client-ip', trusted);
  // server/http.ts
  const ip = request.headers.get('x-client-ip') ?? request.headers.get('cf-connecting-ip') ?? 'local';
  ```
  (On Cloudflare, `cf-connecting-ip` remains authoritative, so keep it as the fallback there.)
- **Fix applied (2026-11-13):**
  - `server/node/clientip.ts` (new): `trustedClientIp()` picks the Nth-from-right `X-Forwarded-For` entry (N = `TRUSTED_PROXY_HOPS`, default 1), else the socket address.
  - `server/node/server.ts`: deletes client-supplied `cf-connecting-ip`, `x-forwarded-for` and `x-client-ip`, then sets `x-client-ip` itself.
  - `server/http.ts`: `ipHash` reads only `cf-connecting-ip` (Cloudflare overwrites it) then `x-client-ip`, and no longer reads `x-forwarded-for`. New `assertNotLocked` / `recordFailure` helpers.
  - `functions/api/auth/login.ts` and `functions/api/admin/login.ts`: failed admin sign-ins are counted in one global bucket (30 per 15 min across all sources) and sign-in is refused while it is full.
  - `server/clientip.test.ts`: 7 new tests.
- **Verification:** `npm run typecheck` clean; `vitest` 40/40 pass. A fresh local instance behind a proxy that appends the peer IP, as Railway's does: rotating `X-Forwarded-For` (plus a fake `X-Client-IP`) → first 429 at attempt 11; rotating `CF-Connecting-IP` on a direct connection → first 429 at attempt 11; 12 distinct real clients → no collateral 429s; correct admin login → 200; 40 admin failures from 40 distinct IPs → 429 from the 31st.
- **Still to do / caveats:** (1) deploy it. (2) After deploying, confirm on Railway that the real visitor IP is the right-most `X-Forwarded-For` entry; if the app sees only Railway's internal proxy address, every visitor shares one bucket (over-throttling), and `TRUSTED_PROXY_HOPS` must be adjusted. (3) The global admin limit means an attacker can lock the owner out of the sign-in form for up to 15 minutes (an existing session keeps working). That is the price of IP-independent protection, and it makes a long random `ADMIN_PASSWORD` (and later MFA, F-13) the real defence. (4) The simulated proxy is my model of Railway, not Railway itself.

---

### F-02 — Open redirect after Google sign-in via TAB character in `next`
- **Severity:** MEDIUM  **Status:** [C] for the validation logic; the live Google round-trip was **not** performed (needs a real Google account and client). **FIXED IN CODE 2026-11-13, pending deploy.** `safeNext` now rejects control characters and backslashes, parses with `new URL`, and requires the placeholder origin; `LoginPage.tsx` has the same check. Verified by 3 new unit tests (43/43 pass, typecheck clean) and against the rebuilt local server (`/api/auth/google?next=<TAB>…` now redirects with `next=/account`).
- **CVSS 4.0 (estimate):** `AV:N/AC:L/AT:N/PR:N/UI:A/VC:N/VI:L/VA:N/SC:L/SI:L/SA:N` ≈ **5.1**
- **Affected:** [`server/accounts.ts:129-132`](server/accounts.ts:129) (`safeNext`), consumed at [`functions/api/auth/google/index.ts:8,27`](functions/api/auth/google/index.ts:8) and [`functions/api/auth/google/callback.ts:20,37`](functions/api/auth/google/callback.ts:20).
- **Endpoint:** `GET /api/auth/google?next=…` → `GET /api/auth/google/callback`
- **Explanation:** `safeNext` blocks `//`, `/\` and `/api/`, but accepts a leading `/` followed by an ASCII TAB (`%09`). The server returns that value verbatim in the `Location` header. Browsers parse `Location` with the WHATWG URL parser, which **removes TAB/CR/LF**, so `/<TAB>/evil.example` becomes `//evil.example`, a protocol-relative URL to another host.
- **Root cause:** Deny-list validation of a redirect target instead of parsing the value and checking the resulting origin.
- **Attack scenario:** The attacker sends the victim `https://shop/api/auth/google?next=%2F%09%2Fphish.example`. The victim completes a **real** Google sign-in on the real site and is then redirected to the attacker's look-alike page ("session expired, enter your card/password again").
- **Business impact:** Phishing with the shop's reputation and a genuine login in the middle. Customers are the target, not the server.
- **Evidence (`extra.mjs`, using the real `safeNext` source text):**
  - `safeNext("/\t/evil.example")` → returned unchanged; Node `writeHead` accepts it; `new URL("/\t/evil.example", "https://shop.example")` → `https://evil.example/`.
  - `//evil.example`, `/\evil.example`, `/api/…` are correctly rejected. CR/LF are rejected by the header layer (not by `safeNext`).
- **Safe reproduction:** Run `extra.mjs` section B (pure function and header test, no external network). Do **not** test against a production Google client.
- **Remediation:** Parse and compare origins, and reject control characters and backslashes.
  ```ts
  export function safeNext(v: string | null | undefined): string {
    const FALLBACK = '/account';
    if (!v || v.length > 300 || /[\u0000-\u001f\u007f\\]/.test(v) || !v.startsWith('/') || v.startsWith('//') || v.startsWith('/api/')) return FALLBACK;
    try {
      const u = new URL(v, 'https://placeholder.invalid');
      return u.origin === 'https://placeholder.invalid' ? u.pathname + u.search + u.hash : FALLBACK;
    } catch { return FALLBACK; }
  }
  ```
  Apply the same check to the client copy at [`src/pages/LoginPage.tsx:20`](src/pages/LoginPage.tsx:20). That one only feeds React Router, so it is not exploitable today.

---

### F-03 — Request bodies are fully buffered before size limits are enforced (unauthenticated memory-exhaustion DoS)
- **Severity:** MEDIUM  **Status:** [R] confirmed by code and a single 5 MB request; **no load test performed** (DoS testing is out of scope). **FIXED IN CODE 2026-11-13, pending deploy** (see "Fix applied" at the end of this finding).
- **CVSS 4.0 (estimate):** `AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N` ≈ **6.9**
- **Affected:** [`server/http.ts:40-44`](server/http.ts:40) (`readJson`: `await request.text()` then `length > maxBytes`), [`functions/api/orders/[number]/proof.ts:20-25`](functions/api/orders/[number]/proof.ts:20) (`await request.formData()` then `file.size > MAX_BYTES`), [`server/node/server.ts:164-172`](server/node/server.ts:164) (body streamed straight into the `Request`, no cap), [`server/node/r2.ts:20-22`](server/node/r2.ts:20) (buffers the file again).
- **Endpoint:** every `POST`/`PUT`/`PATCH`, notably unauthenticated `POST /api/auth/login`, `/api/auth/register`, `/api/orders`.
- **Explanation:** The "max 64 KB" and "max 6 MB" limits are checked **after** the whole body is read into memory. `readJson` also runs **before** `rateLimit` in `auth/login.ts` and `admin/login.ts`. Cloudflare enforces its own platform body limit; the Node server enforces none.
- **Root cause:** Size checks applied to an already-materialised string/`FormData`.
- **Attack scenario:** An attacker streams a multi-GB body to `POST /api/auth/login`. The Node process buffers it, the container hits its memory limit and is killed or swapped, and the shop goes down. Repeating this keeps it down.
- **Business impact:** Loss of availability of the whole shop (single instance, no redundancy).
- **Evidence:** A single 5 MB body to `/api/auth/login` was read in full and rejected only by the **application** (`413 too_large` JSON, 73 ms), i.e. no HTTP-layer limit exists.
- **Safe reproduction:** Send one 5 MB request as above. Do not scale it up.
- **Remediation:** Enforce a hard cap while streaming, and check `Content-Length` first.
  ```ts
  // server/node/server.ts — wrap the request body with a byte cap (e.g. 7 MB; routes needing less still re-check)
  const MAX = 7 * 1024 * 1024;
  if (Number(req.headers['content-length'] ?? 0) > MAX) { res.writeHead(413).end(); return; }
  let seen = 0;
  const capped = Readable.toWeb(req.pipe(new PassThrough()).on('data', c => { if ((seen += c.length) > MAX) req.destroy(); }));
  ```
  Also set `server.requestTimeout`, `headersTimeout` and `maxRequestsPerSocket`, and put `rateLimit` before body parsing.
- **Fix applied (2026-11-13):**
  - `server/http.ts`: new `readBodyText`, `readFormData` and `assertDeclaredSize`. `readJson` now rejects on a declared `Content-Length` over the limit and otherwise reads through a byte-counting stream that fails with 413 the moment the limit is passed. The limit is in **bytes** (it used to count characters after reading everything).
  - `functions/api/orders/[number]/proof.ts`: the upload is parsed with `readFormData(request, 6 MB + 256 KB)` instead of `request.formData()`.
  - `server/node/bodystream.ts` (new) + `server/node/server.ts`: a 7 MB hard ceiling on every request body (declared sizes are refused before reading; chunked bodies are cut off mid-stream), `Connection: close` on 413, `headersTimeout` 30 s and `requestTimeout` 120 s.
  - `functions/api/auth/login.ts`, `admin/login.ts`, `register.ts`, `orders/index.ts`: the IP rate limit now runs **before** the body is read.
  - Tests: `server/http.test.ts` (10), `server/bodystream.test.ts` (4, real Node server), all 57 tests pass, typecheck clean.
- **Bug found and fixed while verifying:** my first version used Node's `Readable.toWeb(req)` and a mid-upload cancel made it throw an uncaught "Controller is already closed" error that **killed the server process** on the first oversized chunked upload. That adapter was replaced by `limitedBody()`, which guards every callback and drains a cancelled body. `bodystream.test.ts` covers an oversized upload, the global cap tripping, and a client that disconnects mid-body, and fails if the process crashes.
- **Verification (local instance, bounded sizes ≤ 40 MB):** declared 5 MB to login → 413 with 0 bytes read; 40 MB chunked to `/api/auth/login` and `/api/orders` → 413 after about 0.4–0.5 MB sent, connection closed; 40 MB chunked to an unknown route → 404 and drained; server stayed up (`/healthz` 200), memory 58 MB → 71 MB after all of it, and the log has no errors. Normal order → 201; 2 KB and 5.5 MB proof uploads → 200.
- **Caveats:** (1) A proof over about 6.25 MB gets a 413 and a closed connection while the browser is still sending, which some browsers report as a network error rather than the JSON message. The site already shrinks screenshots to 1600 px JPEGs before upload, so this is unlikely. (2) `headersTimeout`/`requestTimeout` were set but not tested for slow-drip clients. (3) Memory and capacity of the Railway container were not measured. (4) On Cloudflare the same helpers apply, but that runtime was not exercised.

---

### F-04 — Admin sign-out does not revoke the session (stateless 14-day cookie)
- **Severity:** MEDIUM  **Status:** [C]
- **CVSS 4.0 (estimate):** `AV:N/AC:H/AT:P/PR:N/UI:N/VC:H/VI:H/VA:N/SC:N/SI:N/SA:N` ≈ **5.9**
- **Affected:** [`server/auth.ts:51-58`](server/auth.ts:51) (`createSession`), [`server/auth.ts:65-77`](server/auth.ts:65) (`verifySession`), [`functions/api/admin/login.ts:21-22`](functions/api/admin/login.ts:21) (`DELETE` only clears the cookie), [`functions/api/auth/login.ts:30`](functions/api/auth/login.ts:30).
- **Explanation:** The admin session is `base64(payload).HMAC`, with `{exp, pw-fingerprint}` and no session id and no server-side state. Signing out only sends `Set-Cookie: …Max-Age=0` to the browser. A copy of the cookie remains valid until `exp` (14 days) or until `ADMIN_PASSWORD`, `ADMIN_EMAIL` or `SESSION_SECRET` changes.
- **Root cause:** No server-side session record or revocation list for the admin session. Customer sessions do this correctly.
- **Attack scenario:** The owner signs in on a shared or compromised device (internet café, malware, a screenshot of dev-tools), then signs out believing the session is dead. The copied cookie still opens the dashboard for up to two weeks.
- **Business impact:** Persistent access to PII and payment proofs after the owner believes access is closed.
- **Evidence (T4):** `GET /api/admin/me` with a copied cookie → `200`; `DELETE /api/admin/login` → `200`; the same cookie again → **`200`**.
- **Safe reproduction:** Local instance only: log in as the synthetic admin, copy the cookie, sign out, replay the cookie.
- **Remediation:** Add a random `sid` to the token and store its hash in a table (`admin_sessions`). Check it in `verifySession` and delete it on sign-out. Add a "sign out everywhere" action, and shorten the lifetime (for example 12 h absolute / 2 h idle).

---

### F-05 — No Content-Security-Policy (and no `frame-ancestors`/`base-uri`/`form-action` controls)
- **Severity:** LOW (raise to Medium if you add any rich-text or HTML rendering later)  **Status:** [C]
- **CVSS 4.0 (estimate):** informational/defence-in-depth, ≈ **2.0–3.0**
- **Affected:** [`public/_headers`](public/_headers), [`server/node/static.ts:29-35`](server/node/static.ts:29), [`vercel.json`](vercel.json), [`netlify.toml`](netlify.toml).
- **Explanation:** No `Content-Security-Policy` header is sent on any response (T1: `content-security-policy=∅` on `/`, `/login`, `/admin`, `/api/catalog`).
- **Root cause:** Header set was never extended beyond the basics.
- **Attack scenario:** If a future change introduces an XSS sink (the admin dashboard renders attacker-controlled order text), nothing limits what injected script can do.
- **Business impact:** Higher blast radius of any future XSS, particularly in the admin dashboard.
- **Evidence:** Header test above. **Counter-evidence:** no XSS exists today (see §6): payloads in name/city/address/notes were rendered as text in the admin and public order pages in a real browser, and the source has no `dangerouslySetInnerHTML`/`innerHTML`.
- **Remediation:** Add a CSP in both `_headers` and `SECURITY_HEADERS`. The current page has an inline script and an inline `onload` attribute ([`index.html:19,27`](index.html:19)) and an inlined `<style>`. Use hashes, or move them into files.
  ```
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src https://fonts.gstatic.com; img-src 'self' data: https://*.googleusercontent.com; connect-src 'self';
    object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
  ```
  Use `frame-ancestors 'none'` (or `X-Frame-Options: DENY`) at least for `/admin`.

---

### F-06 — Password hashing parameters and policy are below current guidance
- **Severity:** LOW  **Status:** [R]
- **CVSS 4.0 (estimate):** ≈ **3.0** (impact only after a database leak)
- **Affected:** [`server/accounts.ts:16`](server/accounts.ts:16) (`PBKDF2_ITERATIONS = 100_000`), [`server/accounts.ts:76-79`](server/accounts.ts:76) (`checkPasswordStrength`).
- **Explanation:** PBKDF2-HMAC-SHA256 at 100,000 iterations is well below OWASP's current guidance (600,000). The comment explains the 100k cap is imposed by Cloudflare Workers, but production runs on Node, which has no such cap. Policy is "≥ 8 characters", with no common/breached-password check. Stored hashes carry their iteration count but are never upgraded on login.
- **Root cause:** One hashing parameter for two runtimes; no rehash-on-login.
- **Attack scenario:** After a database or volume leak, customer password hashes are cracked faster than necessary; weak passwords fall almost immediately.
- **Business impact:** Credential-stuffing material for customers' other accounts.
- **Evidence:** Source review. Salt is random 16 bytes and comparison is constant-time (good).
- **Remediation:** Choose iterations per runtime (≥ 600k on Node) or use scrypt/argon2id on Node, and rehash on successful login when the stored cost is lower than the target. Require ≥ 10–12 characters, allow long passphrases, and reject the top-10k common passwords.

---

### F-07 — Customer sessions survive a password change
- **Severity:** LOW  **Status:** [C]
- **CVSS 4.0 (estimate):** ≈ **3.4**
- **Affected:** [`functions/api/auth/me.ts:40-51`](functions/api/auth/me.ts:40)
- **Explanation:** Changing the password updates `users.password_hash` but does not delete other rows in `user_sessions`.
- **Root cause:** Missing session invalidation on credential change.
- **Attack scenario:** A customer notices a stolen session and changes their password; the attacker's session keeps working for up to 30 days.
- **Business impact:** Account takeover persists after remediation by the customer.
- **Evidence (T6):** Two sessions A and B; password changed in A; session B still returns the signed-in user. The old password correctly fails. Sign-out does delete the server-side session.
- **Remediation:** After a successful change, run `DELETE FROM user_sessions WHERE user_id = ? AND token_hash != ?` (keep the current one).

---

### F-08 — Account enumeration (messages and timing)
- **Severity:** LOW  **Status:** [C]
- **CVSS 4.0 (estimate):** ≈ **2.1**
- **Affected:** [`functions/api/auth/register.ts:34-41`](functions/api/auth/register.ts:34) (`email_taken`), [`functions/api/auth/login.ts:35-37`](functions/api/auth/login.ts:35) (`use_google`), [`functions/api/auth/login.ts:38`](functions/api/auth/login.ts:38).
- **Explanation:** Registration says whether an email already exists, and login reveals "this account signs in with Google". Wrong-email logins also return early without running PBKDF2, so response time differs.
- **Root cause:** Distinct error messages and an early return for unknown users.
- **Attack scenario:** An attacker builds a list of customers' emails (and which use Google).
- **Business impact:** Privacy leak; fuel for targeted phishing and credential stuffing.
- **Evidence (T6):** `409 email_taken` on duplicates. Median login time **8.1 ms (unknown email) vs 42.0 ms (existing email)** over 8 samples each.
- **Remediation:** Uniform response for register ("check your email") once email verification exists, a single generic login error, and a dummy `verifyPassword` against a fixed hash for unknown users.

---

### F-09 — Payment-proof upload trusts the client-declared MIME type; state changes allowed on any non-paid order
- **Severity:** LOW  **Status:** [C]
- **CVSS 4.0 (estimate):** ≈ **2.3**
- **Affected:** [`functions/api/orders/[number]/proof.ts:23-28`](functions/api/orders/[number]/proof.ts:23) and `:16,33` (state change), [`functions/api/admin/orders/[id]/proof.ts:11-17`](functions/api/admin/orders/[id]/proof.ts:11).
- **Explanation:** The extension and stored content type come from `file.type` as sent by the client. There are no magic-byte checks and no re-encoding. Any holder of an order token can also flip `payment_status` to `pending_review` for COD orders and `refunded` orders (only `cancelled` and `paid` are blocked).
- **Root cause:** Trusting client metadata; state machine not enforced server-side.
- **Attack scenario:** A customer uploads non-image bytes labelled `image/png`; it is stored and shown to the admin as an image. The admin endpoint serves it as `image/png` with `nosniff`, so browsers will not execute it, which is why this is Low. A customer also re-opens `refunded` orders, which sends a misleading "receipt" notification to the owner.
- **Business impact:** Junk and storage abuse in the owner's inbox; possible confusion in payment review.
- **Evidence (T8):** HTML bytes labelled `image/png` → `200 ok`; `text/html` and `image/svg+xml` → `415`; admin fetch returns `content-type: image/png`, `x-content-type-options: nosniff`, body starts `<html><script>…`.
- **Remediation:** Check magic bytes (`FFD8FF`, `89504E47`, `RIFF….WEBP`), ideally re-encode, restrict the state change to `payment_method != 'cod'` and `payment_status IN ('unpaid','pending_review')`, and add `content-security-policy: sandbox; default-src 'none'` to proof responses.

---

### F-10 — Static file server uses a prefix check (backslash traversal into sibling `dist*` directories on Windows hosts)
- **Severity:** LOW (not exploitable on Linux/Railway as far as the code shows; real on Windows dev/staging machines)  **Status:** [C] on Windows; Linux behaviour [P] (inferred: backslash is not a path separator there).
- **CVSS 4.0 (estimate):** ≈ **2.7**
- **Affected:** [`server/node/static.ts:49-52`](server/node/static.ts:49) (`full.startsWith(path.resolve(this.root))`) and [`:68`](server/node/static.ts:68) (only `/`-separated `..` is rejected).
- **Explanation:** The containment check has no trailing separator, so `…\dist-server` passes as "inside" `…\dist`. On Windows, a decoded `\..\` is a real separator.
- **Root cause:** String-prefix path containment; `..` detection split only on `/`.
- **Attack scenario:** On a Windows host, `GET /%5c..%5cdist-server%5cserver.mjs` returns the server bundle and its source map.
- **Business impact:** Source disclosure only on Windows-hosted instances. The bundle contains no secrets (verified: no key patterns in `dist-server/server.mjs`).
- **Evidence (`extra.mjs` A):** all three payloads returned `200` with the bundle/source map on the local Windows instance; the generic `..%2f` and `..%5cpackage.json` variants correctly failed (`404`).
- **Remediation:**
  ```ts
  const root = path.resolve(this.root);
  const full = path.resolve(root, `.${rel}`);
  if (full !== root && !full.startsWith(root + path.sep)) return null;   // note the separator
  // and reject '\\' in p before resolving
  ```

---

### F-11 — Admin-registered push endpoint makes the server call arbitrary HTTPS URLs (SSRF-capable, admin-only)
- **Severity:** LOW  **Status:** [P] (code review; not exercised because it needs an admin session and a callback target)
- **CVSS 4.0 (estimate):** ≈ **2.4**
- **Affected:** [`functions/api/admin/push.ts:13-15`](functions/api/admin/push.ts:13) (only `^https://` is checked), [`server/push.ts:48-60`](server/push.ts:48) (`fetch(endpoint, {method:'POST', …})`).
- **Explanation:** Any `https://` URL is accepted as a "push endpoint". On every new order the server POSTs to it with a VAPID `Authorization` header.
- **Root cause:** No allow-list of push-service hosts and no private-address filtering.
- **Attack scenario:** An attacker who already holds the admin session registers `https://internal-service/…` and triggers blind POSTs from the server (or points it at a server they control to learn the server's egress IP). The JWT is signed per audience and leaks no key.
- **Business impact:** Limited, since admin access is already total. This is hardening and defence in depth.
- **Evidence:** Source review only.
- **Remediation:** Allow-list the known push hosts (`fcm.googleapis.com`, `updates.push.services.mozilla.com`, `*.notify.windows.com`, `web.push.apple.com`) and refuse private/loopback targets.

---

### F-12 — Vulnerable development dependencies (none in production dependencies)
- **Severity:** LOW  **Status:** [C] (npm advisory data fetched 2026-11-13)
- **CVSS 4.0 (estimate):** n/a, advisory scores are CVSS 3.x as published by npm (up to 9.x for the Tinypool advisories)
- **Affected:** [`package.json`](package.json) devDependencies `vitest`, `wrangler` (→ `miniflare` → `undici`), `sharp`.
- **Explanation:** `npm audit` reports 7 vulnerable packages: **2 critical** (`tinypool` prototype-pollution → RCE, via `vitest`; `vitest` itself), **2 high** (`sharp` libvips/libheif/librsvg advisories; `undici` several DoS/TLS/cache issues), **3 moderate**. `npm audit --omit=dev` reports **0 vulnerabilities across the 7 production dependencies**.
- **Root cause:** Pinned exact dev tool versions have fallen behind.
- **Attack scenario:** These tools only run on the developer's machine or in Railway's build step. Exploiting `tinypool`/`vitest` needs attacker-controlled test files or mocks; `sharp` only processes the repository's own images. Realistic risk is limited to a compromised repo or PR.
- **Business impact:** Low; relevant if third parties can contribute code, or if the build environment holds secrets.
- **Evidence:** `npm audit --json` output (summarised in Appendix B).
- **Remediation:** Upgrade to the versions npm lists as fixes: `vitest@4.1.12` (semver-major, re-run tests), `wrangler@4.161.0`, `sharp@0.35.5`. Enable Dependabot/Renovate and run `npm audit --omit=dev` in CI.

---

### F-13 — Single shared, single-factor admin credential with no audit trail
- **Severity:** LOW (design)  **Status:** [R]
- **CVSS 4.0 (estimate):** ≈ **3.0** alone. It amplifies F-01 and F-04.
- **Affected:** [`server/auth.ts:28-33`](server/auth.ts:28), [`server/node/secrets.ts:38-39`](server/node/secrets.ts:38).
- **Explanation:** One `ADMIN_EMAIL` + `ADMIN_PASSWORD` pair, no MFA, no per-user accounts or roles, and no log of admin sign-ins or actions (`order_events` records what changed, not who).
- **Root cause:** Simplicity-first design for a one-owner shop.
- **Attack scenario:** One leaked or guessed password gives full control, with no trace of the attacker's activity.
- **Business impact:** See F-01.
- **Evidence:** Code review.
- **Remediation:** Use a long random admin password (≥ 20 characters from a password manager) now. Add TOTP or passkey for the owner, send the owner a push notification on every admin sign-in, and log sign-ins and mutations with timestamp and source IP.

---

## 6. Informational observations

| ID | Observation | Evidence / location |
|---|---|---|
| **I-01** | **Forwarded host/proto trusted from any client** (`x-forwarded-host`, `x-forwarded-proto`). They build `request.url`, which feeds the Google `redirect_uri`, the `Secure` cookie flag and the same-origin check. A browser victim cannot be made to send them, and Google only accepts registered redirect URIs, so no exploit was found. **[P]** Pin the public origin in config. Note also: the Google ID token's signature is not re-verified (acceptable when received directly from Google's token endpoint over TLS, as Google documents). | [`server/node/server.ts:156-157`](server/node/server.ts:156), [`server/accounts.ts:158-206`](server/accounts.ts:158) |
| **I-02** | **No security logging or alerting.** Failed logins, rate-limit hits and admin actions are not logged; the server logs only `METHOD path status ms` for `/api/*`. | [`server/node/server.ts:199`](server/node/server.ts:199) |
| **I-03** | **Header hardening:** HSTS without `includeSubDomains`/`preload`; `X-Frame-Options: SAMEORIGIN` (use `DENY` for admin); no COOP/CORP. CORS is not enabled at all (secure default; preflight returned `405` with no `Access-Control-Allow-Origin`). | `public/_headers`, T1/T5 |
| **I-04** | **Order access token travels in the URL query** (`?t=`). Entropy is fine (144 bit), but tokens persist in browser history, link shares and any edge/access logs. The Node logger strips the query string; Railway's edge logs were not checked. Comparison is not constant-time (not practically exploitable at this entropy). | [`functions/api/orders/[number].ts:7-9`](functions/api/orders/[number].ts:7) |
| **I-05** | **Data protection:** customer PII and payment screenshots live in one SQLite file and one folder on a single Railway volume. Backups are manual ("download it from the volume"), there is no retention or deletion/export feature, and the checkout stores name/phone/city/address in `localStorage` (`coco-customer`) in clear text (risk on shared computers). | `README.md:135`, [`src/pages/CheckoutPage.tsx:150-152`](src/pages/CheckoutPage.tsx:150) |
| **I-06** | **Public payment details:** `GET /api/catalog` serves the shop's InstaPay/wallet numbers to anyone without an order. This is probably intended (shown at checkout), but it also lets scammers copy them. | [`functions/api/catalog.ts:8-10`](functions/api/catalog.ts:8) |
| **I-07** | **Dead duplicate code:** `node-server/d1.ts` and `node-server/r2.ts` are not imported by anything and are untracked in git (the live ones are in `server/node/`). Risk of the wrong copy being fixed. | `node-server/` |
| **I-08** | **Placeholder site URL:** the local `dist/` was built with `VITE_SITE_URL` unset, so canonical/OG/sitemap URLs point to `www.example.com` (88 occurrences in `sitemap.xml`). Check that the Railway build sets it. | `src/config/site.ts:22`, `scripts/prerender.mjs:76` |
| **I-09** | **Scope gaps:** no Dockerfile, CI/CD or IaC exist, so there was nothing to review there. Railway/Cloudflare console settings (volume permissions, private networking, env-var exposure, build logs) need a separate review with console access. | — |

### Positive controls verified (tests actually performed)
- **SQL injection:** all queries use bound parameters. The two interpolated values (`range`, `day`) are server-validated constants. A `' OR 1=1 --` search returned `total=0`; a malformed `range` fell back to `30`.
- **AuthN/AuthZ:** the 6 admin endpoints tried (list, customers, settings write, proof, notifications, push) returned `401` without a cookie; the others share the same middleware (code review); a forged cookie returned `401`; customer endpoints are scoped by `user_id`; no admin-state path was reachable from the customer session.
- **BOLA/IDOR:** order view with a wrong or missing token → `404`; neighbouring order number without token → `404`. Admin order and proof routes require the admin cookie.
- **Mass assignment:** `email_verified`, `isAdmin`, `role`, `id` sent to `/api/auth/register` were ignored (user id assigned by DB; response contains no such fields). Client-supplied `price`/`total`/`subtotal`/`unitPrice`/`deliveryFee` in orders were ignored; totals come only from server-side overrides.
- **Business logic:** quantity > 99 → `400`; hidden, unknown or sold-out products are rejected server-side; there are no coupons or discount features.
- **CSRF:** cross-origin `Origin` → `403`, `Origin: null` → `403`, `text/plain` body → `415`; cookies are `HttpOnly`, `SameSite=Strict` (admin) / `Lax` (customer, needed for the Google redirect).
- **XSS (stored/reflected/DOM):** `<img src=x onerror=…>` payloads in name, city, address and notes were rendered as inert text in `/admin/orders/:id`, `/admin/orders`, `/admin/customers` and the public `/order/:n` page in a real browser (`window.__xss` never set, 0 injected `<img>`); source has no `dangerouslySetInnerHTML`/`innerHTML`/`eval`; SEO JSON-LD escapes `<`.
- **Secrets:** no key patterns in tracked files, in the full git history (`git log -S GOCSPX` → 0), in `dist/` or in `dist-server/` bundles. `.dev.vars` is git-ignored and untracked. **Precaution:** it contains a real Google OAuth client secret in plaintext, and the folder is named "handoff". If the folder (not only the git repo) was ever zipped or shared, rotate that secret.
- **Sessions:** customer tokens are 256-bit random and only their SHA-256 is stored; sign-out revokes server-side; no fixation (token minted on login).
- **Info leakage:** generic `500` message; malformed JSON → short code; no stack traces; no `.env`/`.git`/source-map exposure over HTTP (`404`).

---

## 7. Remediation Roadmap

| Priority | Items | Effort |
|---|---|---|
| **Immediate (Critical)** | none | — |
| **Priority (High) — before real marketing/traffic** | **F-01**: stop trusting client IP headers on Node; add IP-independent throttle on the admin credential. Set a long random `ADMIN_PASSWORD` now. | 1–3 h |
| **Short-term (Medium) — within ~2 weeks** | **F-02** harden `safeNext`; **F-03** cap request bodies while streaming + timeouts; **F-04** server-side admin sessions with revocation | 3–6 h |
| **Short-term (Low)** | F-07 revoke sessions on password change; F-05 add CSP (needs inline script/handler cleanup); F-09 magic-byte checks and state guard; F-10 separator-aware path check; F-08 uniform auth errors; F-12 update dev dependencies | 1 day |
| **Long-term** | F-06 stronger hashing + policy; F-13 MFA/passkey and admin audit log with sign-in alerts; F-11 push-host allow-list; I-02 security logging and alerting; I-05 automated, encrypted off-site backups, retention policy and a customer data deletion/export process; CI with `npm audit --omit=dev`, secret scanning and dependency updates; periodic re-test after changes | ongoing |

---

## 8. Final Assessment

**Requires security improvements before production use at scale.** For a small shop with a modest, non-targeted audience it is reasonably well built, and the issues above are fixable in a day or two of work. However, the combination of F-01 (rate limits are decorative on the Railway deployment) and F-13 (a single-factor admin password guarding all customer data) means the owner dashboard is currently protected only by the strength of one password. Fix F-01 and set a strong password first; then F-02/F-03/F-04.

This is **not** a statement that the application is secure. The assessment covered the source code and a local test instance only. It did not cover the live Railway environment, DNS/TLS, the Cloudflare runtime, a complete Google OAuth round-trip, load/DoS behaviour, or social-engineering and physical risks. A short retest after remediation is recommended, including a non-destructive check of the production headers and rate limiting once you authorize it.

---

## Appendix A — Test log (local synthetic instance, `localhost:3999`, scratch DB, synthetic credentials)

| ID | Check | Result |
|---|---|---|
| T1 | Security headers on `/`, `/login`, `/admin`, `/api/catalog` | HSTS, XFO, nosniff, referrer, permissions present; **no CSP**; no CORS headers |
| T2 | 6 admin endpoints unauthenticated + forged cookie | all `401` |
| T3 | Rate-limit baseline vs spoofed headers (customer + admin login) | 429 at attempt 11 fixed IP; **0 × 429 in 80 spoofed attempts** → F-01 |
| T4 | Admin cookie replay after sign-out | still `200` → F-04 |
| T5 | CSRF/origin/CORS/content-type | cross-origin `403`, `null` `403`, `text/plain` `415`, preflight `405` w/o ACAO |
| T6 | Register mass-assignment, enumeration, sessions, password change, timing | mass-assignment ignored; `email_taken`; **old session survives password change** → F-07; **8.1 vs 42.0 ms** → F-08 |
| T7 | Orders: server pricing, token checks, qty, spam | prices ignored from client; wrong/missing token `404`; qty 100 → `400`; **12/12 spam orders accepted with rotating header** → F-01 |
| T8 | Proof upload MIME handling; admin proof response; SQLi search; stats param | HTML-as-PNG accepted (F-09); SQLi inert; bad range falls back |
| T9 | Static traversal: 12 payloads + 3 sibling-prefix payloads (raw socket) | generic traversal blocked; **backslash sibling-dir read on Windows** → F-10 |
| T10 | Error handling | short, non-leaking messages |
| T11 | One 5 MB body (not a load test) | app-level `413` after full read → F-03 |
| B | `safeNext` with 9 inputs, real source text | **TAB accepted → resolves to external host** → F-02 |
| Browser | Stored-XSS payloads in 4 admin/public pages | no execution |

## Appendix B — Dependency audit summary (`npm audit`, 2026-11-13)
Production dependencies (7): **0 advisories**. Development (318 transitive): `vitest` (critical, fix `4.1.12`), `tinypool` (critical, via vitest), `sharp` (high, fix `0.35.5`), `undici` (high, via `wrangler`/`miniflare`, fix `wrangler@4.161.0`), `@vitest/mocker`, `miniflare`, `wrangler` (moderate). Lock-file versions are exact-pinned, which is good practice.
