# CONNECT — Master Audit & Expansion Plan

> **Scope of this document.** A complete, line-anchored audit of the entire `C:\connect`
> codebase, followed by an **expansion roadmap**: every feature, capability, security
> control, UX behaviour and platform improvement that _should_ exist but does not yet.
>
> **Hard rule for every workstream in this plan: EXPANSION ONLY — never restyle.**
> All work must reuse the existing design system (`--cx-*` tokens in `app/globals.css`,
> `components/ui` primitives, `lucide-react` icons). No new colours, no new type scale,
> no layout re-skin. New UI is _added into_ existing surfaces at the placement points
> named below. Style changes are explicitly out of scope and will be rejected in review.
>
> **Baseline verified at audit time** (commands run on this machine, Node `C:\Program Files\nodejs`):
>
> | Gate  | Command             | Result                                                          |
> | ----- | ------------------- | --------------------------------------------------------------- |
> | Types | `npm run typecheck` | **0 errors** OK                                                 |
> | Tests | `npm run test`      | **47 passed / 47** (5 files) OK                                 |
> | Lint  | `npm run lint`      | **0 errors, 4 warnings** (all `no-explicit-any`) OK             |
> | Build | `npm run build`     | **passes**, all routes emitted, `Proxy (Middleware)` present OK |
>
> So the codebase is _green_. This plan is therefore **not a repair list** — it is a
> hardening + expansion program on top of a working 1.0.0 baseline.

---

## 0. How to read this plan

Every finding is tagged so workstreams can be split across parallel agents without
overlap:

| Tag      | Meaning                                   | Severity                       |
| -------- | ----------------------------------------- | ------------------------------ |
| `[SEC]`  | Security / authorization / privacy        | CRITICAL / HIGH / MEDIUM / LOW |
| `[API]`  | Route handler / contract / error envelope | same                           |
| `[DB]`   | Postgres / RLS / migration / RPC          | same                           |
| `[CORE]` | Domain service / business logic           | same                           |
| `[UI]`   | Feature expansion on existing surfaces    | same                           |
| `[A11Y]` | Accessibility                             | same                           |
| `[PERF]` | Performance / bundle / query cost         | same                           |
| `[OBS]`  | Logging / metrics / tracing / Sentry      | same                           |
| `[DX]`   | Build, CI, tooling, docs, tests           | same                           |
| `[SEO]`  | Metadata / robots / sitemap / OG          | same                           |

Every item carries: **ID · title · evidence (file:line) · why · exact change · acceptance test.**
Items are grouped into **workstreams (section 2)** that are _file-disjoint_ so multiple agents
can execute in parallel (see the swarm protocol in section 9).

---

## 1. Codebase map & verified inventory

### 1.1 What exists (counted, not guessed)

| Layer               | Count                                                 | Location                                             |
| ------------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| Pages / routes      | 44 `.tsx` under `app/`                                | `app/**`                                             |
| Route handlers      | 11 under `app/api/`                                   | `app/api/**`                                         |
| Server Actions      | 11 under `app/actions/`                               | `app/actions/**`                                     |
| Domain services     | 84 `.ts` across **17** bounded contexts               | `services/**`                                        |
| Infra modules       | 62 `.ts`                                              | `lib/**`                                             |
| UI components       | 33 `.tsx` (incl. 14 `ui/` primitives)                 | `components/**`                                      |
| Client data layer   | 12 `.ts` (api/http/query/websocket)                   | `client/**`                                          |
| Hooks               | 9 (`hooks/` + `lib/hooks/`)                           | both                                                 |
| Migrations          | 93 SQL files (74 migrations + probes + tests + seeds) | `supabase/**`                                        |
| Unit/contract tests | 5 files / 47 tests                                    | `tests/`, `lib/*.test.ts`, `services/auth/*.test.ts` |
| SQL probes          | 14 invariant probes                                   | `supabase/tests/**`                                  |
| Docs                | README, ARCHITECTURE, RUNBOOK, CHANGELOG              | root + `docs/`                                       |

### 1.2 Architectural invariants (must be preserved by every change)

1. **Dependency direction is one-way:** `app -> services -> lib -> types`. Violations are bugs.
2. **Server Actions are the only UI mutation entry point** (ADR-002); `app/api/*` is for
   machine callers, provider callbacks, file exports and guest-safe reads.
3. **Authorization is enforced twice:** RLS in Postgres _and_ capability checks in
   `services/auth/capabilities.ts`. Neither may be removed.
4. **No queue broker** (ADR-001): background work runs inline, on `pg_cron`, or via the
   `WORKER_SECRET` worker.
5. **Fail closed** when an optional integration is unconfigured (ADR-007).
6. **`next.config.mjs` is the single authority for response security headers** (ADR-006).
7. **One canonical open-redirect validator** — `lib/redirect.ts` (ADR-005).

> Any item below that would break an invariant is flagged **[INVARIANT]** and must ship with
> a documented ADR amendment.

---

## 2. Workstreams (parallel-safe, file-disjoint)

| WS        | Name                          | Owns (files/dirs)                                                                                                      | Depends on         | Items            |
| --------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------- |
| **WS-1**  | Security & Auth Hardening     | `proxy.ts`, `lib/csrf.ts`, `lib/redirect.ts`, `lib/security.ts`, `lib/ratelimit.ts`, `lib/auth.ts`, `services/auth/**` | —                  | SEC-01..SEC-14   |
| **WS-2**  | API Contract & Error Envelope | `app/api/**`, `lib/errors.ts`, `lib/messages.ts`                                                                       | WS-1 (types only)  | API-01..API-10   |
| **WS-3**  | Data Layer & RLS              | `supabase/migrations/**` (new, timestamped), `supabase/probes/**`                                                      | —                  | DB-01..DB-08     |
| **WS-4**  | Domain Services               | `services/**` (except `auth/`)                                                                                         | WS-3 schemas       | CORE-01..CORE-09 |
| **WS-5**  | UI Feature Expansion          | `app/**/*.tsx`, `components/**`                                                                                        | WS-2 contracts     | UI-01..UI-22     |
| **WS-6**  | Accessibility                 | `components/a11y/**`, route `tsx`                                                                                      | WS-5 layout points | A11Y-01..A11Y-09 |
| **WS-7**  | Performance                   | `next.config.mjs`, `client/**`, `lib/cache/**`, `services/search/**`                                                   | WS-3 indexes       | PERF-01..PERF-08 |
| **WS-8**  | Observability & Ops           | `lib/logger.ts`, `lib/observability.ts`, `sentry.*.ts`, `instrumentation*.ts`, health routes                           | —                  | OBS-01..OBS-08   |
| **WS-9**  | DX / CI / Tests / Docs        | `package.json`, `.github/**`, `tests/**`, `vitest.config.mjs`, docs                                                    | all                | DX-01..DX-14     |
| **WS-10** | SEO / PWA / Metadata          | `app/manifest.ts`, `app/robots.ts`, `app/sitemap.ts`, route `metadata` exports                                         | WS-5               | SEO-01..SEO-07   |

**Parallelism rule:** a workstream may start when its dependency has _merged its type
contract_ (not necessarily its implementation). WS-1/3/8 have no upstream and can begin
immediately. WS-5 is the widest — split it into 5a (chat), 5b (events), 5c (ideas/matches),
5d (profile/settings), 5e (admin/traction/public) across sub-agents because the file sets
are disjoint.

---

## 3. WS-1 — Security & Auth Hardening

### SEC-01 CRITICAL — Bearer comparison in the worker is not constant-time

**Evidence:** `app/api/queue/worker/route.ts:30` — `return header === 'Bearer ${secret}'`.
**Why:** the comment calls it "constant-time-ish" but `===` on strings short-circuits at
the first differing byte, leaking secret length/prefix to a timing oracle on a
machine-authenticated endpoint.
**Change:** extract a shared `safeCompare(a, b)` into `lib/security.ts` using
`crypto.timingSafeEqual` over equal-length buffers, returning `false` on length mismatch
_fixed-time-ish_ by comparing against a same-length dummy. Use it in the worker **and** in
any future machine route.
**Acceptance:** unit test `lib/security.test.ts` proves `safeCompare('a','a')===true`,
`('a','b')===false`, differing lengths `false` without throwing; existing worker 401 test
still passes.

### SEC-02 HIGH — CSRF protection is scaffolded but not enforced on Server Actions

**Evidence:** `lib/csrf.ts` exports `generateCsrfToken`/`verifyCsrfToken`/`extractCsrfToken`,
but **no `app/actions/*.ts` file calls `verifyCsrfToken`**. The ARCHITECTURE section 3.2 diagram
claims CSRF is verified at the top of every action — that claim is currently false.
**Why:** Next.js Server Actions have built-in Origin checks, but the codebase documents an
explicit HMAC double-submit control that is dead code. Either enforce it or delete the
claim. Given the security posture, **enforce it**.
**Change:** add a single HOF `withCsrf(action)` in `lib/csrf.ts` that (a) reads the
`__Host-csrf` cookie, (b) reads the `x-csrf-token` header / form field, (c) calls
`verifyCsrfToken`, (d) returns a canonical denial envelope on failure, else runs the
action. Wrap every mutating action in `app/actions/**`. Add a Server Action that mints the
token and a client helper that attaches the header for `fetch`-based submissions.
**Acceptance:** a new `lib/csrf.test.ts` covers valid/invalid/missing tokens; a contract
test asserts every exported mutating action is wrapped (introspect the action modules).
**[INVARIANT]** — must update ARCHITECTURE section 3.2 to say "enforced", not "verified".

### SEC-03 HIGH — `proxy.ts` suspension check issues a DB query on every matched request

**Evidence:** `proxy.ts:283-287` runs a `profiles.select('suspended_at')` on **every**
proxied request including every `/api/*` call and every RSC navigation.
**Why:** a synchronous DB round-trip in middleware adds latency to 100% of traffic and is a
single point of failure; if Postgres is slow, the whole edge gate slows.
**Change:** cache the suspension flag in Upstash Redis keyed by `suspended:${userId}` with a
short TTL (e.g. 60 s) and a version salt bumped when safety changes suspension state
(`services/safety/**`). Fail **closed** on cache miss+DB error (keep current behaviour) but
serve the TTL hit zero-DB. Invalidate the key in `services/safety/safety.service.ts` and in
`services/admin/service.ts` when `suspended_at` is written.
**Acceptance:** proxy unit/integration test shows one DB hit then cache hits; safety suspend
test shows the key is purged.

### SEC-04 HIGH — Guest rate-limit identifier recomputes `operationGroup` three times

**Evidence:** `proxy.ts:187-188` calls `operationGroup(path, method)` twice on adjacent lines
and destructures `limiter` from a third call; same pattern at `240-242`.
**Why:** wasteful and a latent bug — if `operationGroup` ever becomes non-pure, the
identifier and limiter could diverge.
**Change:** compute `const op = operationGroup(path, method)` once and reuse `op.group` /
`op.limiter`.
**Acceptance:** behavioural test unchanged; lint shows no re-invocation.

### SEC-05 MEDIUM — `x-user-id` / `x-user-email` are trusted downstream without signature

**Evidence:** `proxy.ts:317-318` sets `x-user-id` and `x-user-email` on the forwarded
request; ARCHITECTURE section 3.1 says downstream may read these headers.
**Why:** any upstream proxy that does not strip client-supplied `x-user-id` lets a client
spoof identity to any route handler that trusts the header. This is the classic
"trusted-header" trap.
**Change:** (a) document a hard requirement that the ingress strips `x-user-*` inbound, and
(b) add a defensive re-derivation helper `requireUserId(req)` in `lib/auth.ts` that prefers
the Supabase session and uses the header only as a hint, so no handler _authorizes_ on the
header alone. Remove `x-user-email` from the forward set unless a consumer needs it (grep
shows none).
**Acceptance:** grep test asserts no route handler grants access purely from `x-user-id`.

### SEC-06 MEDIUM — Rate-limit headers use a custom scheme, not the standard

**Evidence:** `lib/ratelimit.ts:167-176` emits `X-RateLimit-Limit/Remaining/Reset`.
**Why:** clients, CDNs and monitoring expect IETF `RateLimit-Limit`, `RateLimit-Remaining`,
`RateLimit-Reset`; `Retry-After` is required on `429` for correctness.
**Change:** emit **both** the legacy `X-` headers (compat) and the IETF names, and add
`Retry-After: <seconds>` on every `429` branch in `proxy.ts`.
**Acceptance:** next-config/contract test asserts the header names on a simulated 429.

### SEC-07 MEDIUM — CSP still allows `'unsafe-inline'` for `script-src`

**Evidence:** `next.config.mjs:35` `const scriptSrc = ["'self'", "'unsafe-inline'"]`; README
"Known gaps" #3.
**Why:** `'unsafe-inline'` for scripts defeats XSS mitigation. Nonce path is scaffolded in
`lib/security.ts:22 buildCspHeader` but unused.
**Change:** roll out nonce-based CSP: generate a per-request nonce in `proxy.ts`, set it as
a request header, apply `buildCspHeader(nonce)` via `next.config.mjs` **replacing** the
static policy (never both). Verify with `browser-automation` skill (console must show zero CSP violations).
**Acceptance:** `tests/next-config.test.ts` updated; headless browser run on `/` and
`/dashboard` shows no `Content-Security-Policy` violations and no `<script>` blocked.
**[INVARIANT]** — update ARCHITECTURE section 5 threat-model note.

### SEC-08 MEDIUM — No Content-Security-Policy reporting endpoint

**Evidence:** `lib/security.ts:58 logCspViolation` exists but nothing calls it; no
`report-uri`/`report-to` in the CSP.
**Why:** without reporting you cannot safely tighten CSP because you cannot see what breaks.
**Change:** add `POST /api/security/csp-report` (public, rate-limited, body-size-capped,
scrubbed) that forwards to `logger.warn` + Sentry; add `report-uri` to the CSP.
**Acceptance:** posting a sample report returns 204 and emits a scrubbed log line.

### SEC-09 MEDIUM — Turnstile is declared but never enforced

**Evidence:** `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` in `lib/env.ts:12,26`
and CSP `frame-src https://challenges.cloudflare.com`, but no call site verifies a token.
**Why:** signup/login abuse protection is advertised but absent.
**Change:** add `lib/turnstile.ts` (`verifyTurnstile(token, ip)` -> fail-closed when secret
unset), call it in the login/signup action behind a feature flag `turnstile` in
`config/feature-flags.ts`, render the widget only when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is
present.
**Acceptance:** with secret unset the action skips (documented fail-closed); with secret set
and an invalid token it returns the canonical denial.

### SEC-10 LOW — `lib/security.ts` is largely dead code

**Evidence:** `generateCspNonce`, `getCspNonce`, `SECURITY_HEADERS`, `getSecurityHeaders`
have no consumers (headers are owned by `next.config.mjs`).
**Why:** two sources of security headers is a trap (the file even warns about it).
**Change:** after SEC-07, keep only `buildCspHeader` + `safeCompare` + `logCspViolation` +
the redirect re-export; delete `SECURITY_HEADERS`/`getSecurityHeaders` or mark them
`@deprecated` with a test asserting `next.config.mjs` is the only header source.
**Acceptance:** `grep SECURITY_HEADERS` -> only used in a deprecation test or removed.

### SEC-11 MEDIUM — Attachment path validation should be explicit + tested

**Evidence:** ARCHITECTURE section 5 claims `sendMessageSchema` constrains attachment paths to the
sending match's storage prefix; confirm it and add a regression probe.
**Change:** add unit cases proving `../` and foreign-prefix paths are rejected.
**Acceptance:** new tests in `services/chat/*.test.ts`.

### SEC-12 MEDIUM — MFA support is present but not surfaced or enforced

**Evidence:** `services/auth/mfa.ts` exists; `/settings/security` page renders a shell.
**Why:** a security feature users cannot reach is not a control.
**Change:** expand `services/auth/mfa.ts` usage: enrolment (QR via existing `qrcode` dep +
`speakeasy`), verify, recovery codes, and a proxy gate step that challenges when
`profiles.mfa_required`. Surface entirely inside the existing `/settings/security` shell.
**Acceptance:** MFA unit tests; proxy test shows challenge redirect for `mfa_required` users.

### SEC-13 LOW — Add security headers to error/404/500 responses explicitly

**Evidence:** `next.config.mjs` sets `source: '/:path*'` which should cover these, but a
contract test for the _error_ path is missing.
**Change:** extend `tests/next-config.test.ts` to assert headers apply correctly and that
`global-error` responses inherit CSP.
**Acceptance:** test passes.

### SEC-14 MEDIUM — Session cookie hardening should be asserted, not assumed

**Evidence:** Supabase SSR manages cookies; no assertion that they are `HttpOnly`,
`SameSite=Lax|Strict`, `Secure` in prod.
**Change:** add an integration assertion (documented in RUNBOOK) and a `proxy.ts` guard that
upgrades cookie options passed back by `setAll`.
**Acceptance:** RUNBOOK checklist item + test where feasible.

---

## 4. WS-2 — API Contract & Error Envelope

### API-01 HIGH — No canonical JSON error envelope across route handlers

**Evidence:** handlers return ad-hoc shapes: `{ error: 'Invalid query' }`
(`api/search/route.ts:29`), `{ error: 'Authentication required.' }`
(`api/gdpr/export/route.ts:17`), `{ error: 'Forbidden.' }`
(`api/events/analytics/route.ts:62`), `{ error: 'Unknown task: ...' }`
(`api/queue/worker/route.ts:108`). `lib/errors.ts` and `lib/messages.ts` exist but are
not used by the APIs.
**Why:** clients (and `client/api/http.ts`) cannot programmatically discriminate failures;
i18n copy cannot be centralised.
**Change:** define `ApiError` envelope `{ error: { code, message, requestId }` in
`lib/errors.ts`, add `apiError(code, requestId)` / `apiOk(data, requestId)` helpers, and
route **all** `app/api/**` returns through them. Codes come from `lib/messages.ts`
(`ERROR_CODES`) so copy stays single-sourced.
**Acceptance:** contract test asserting every API export uses the envelope; update
`client/api/http.ts` to parse `error.code`.

### API-02 HIGH — Error responses never carry `x-request-id`

**Evidence:** `proxy.ts:116` echoes `x-request-id` on the _proxy_ response, but route
handlers that build their own `NextResponse` (e.g. `api/gdpr/export` 500 at line 29) do not
propagate the handler's request id, so a support ticket cannot be correlated to a log line.
**Why:** correlation id is half-wired.
**Change:** read `x-request-id` in each handler (helper `getRequestId(req)`) and include it
in the envelope and response header (API-01 makes this natural).
**Acceptance:** request to a failing route returns `x-request-id` matching the log line.

### API-03 MEDIUM — `GET /api/browse` has no pagination, no cache headers, no error handling

**Evidence:** `api/browse/route.ts` returns fixed `limit: 20`, no try/catch, no
`Cache-Control` beyond the global `no-store`.
**Change:** accept `?limit`/`?cursor`, wrap in try/catch -> envelope, and (because it is
guest-safe public data) allow a _short_ public cache only after confirming no per-user
leakage. Default keep `no-store`, allow opt-in `?fresh=0`.
**Acceptance:** 400 on bad limit; 200 envelope on success; cache test.

### API-04 MEDIUM — `GET /api/gdpr/export` is a GET that mutates (creates a job)

**Evidence:** `api/gdpr/export/route.ts:12` `GET` calls `requestExportJob` (a write).
**Why:** GET must be safe/idempotent per HTTP; prefetchers, crawlers and retries can create
duplicate jobs.
**Change:** change to `POST /api/gdpr/export` (keep GET as a _status_ read), update
`ROUTES.api` + callers.
**Acceptance:** contract test: GET does not create a job; POST does.

### API-05 HIGH — No idempotency keys on GDPR/export actions

**Evidence:** `requestExportJob`/`requestEraseJob` called directly; double-click or retry
can enqueue twice.
**Change:** accept an `Idempotency-Key` header, store recent keys in Redis (TTL 24 h), and
short-circuit duplicates with the original result.
**Acceptance:** two POSTs with the same key -> one job row.

### API-06 MEDIUM — Analytics export has no row cap / streaming

**Evidence:** `api/events/[eventId]/analytics/export/route.ts:112` `buildCsv` joins unbounded
arrays; a huge event could OOM.
**Change:** cap export window, stream via `ReadableStream`, add `Content-Length` when known.
**Acceptance:** synthetic large export test stays within memory budget.

### API-07 MEDIUM — Export route lacks `Cache-Control: no-store` on the _blob_ path

**Evidence:** manual `NextResponse` at `export/route.ts:104,114` bypasses the usual path.
**Change:** add explicit `no-store` + `X-Robots-Tag: noindex` to export responses.
**Acceptance:** test asserts the header.

### API-08 MEDIUM — LinkedIn sync has dead code and a misleading comment block

**Evidence:** `api/linkedin/sync/route.ts:57-75` constructs an unused `_api` client whose
`getAccessToken` returns `null`, followed by a confused comment block; `_token` at 61-64 is
dead.
**Why:** dead code hides the real token path and will mislead the next maintainer.
**Change:** delete lines 57-79 dead scaffolding; keep only the `getSession()` path already
used at 80-103.
**Acceptance:** typecheck clean; behaviour unchanged; no `_api`/`_token` remnants.

### API-09 HIGH — Route handlers duplicate session resolution boilerplate

**Evidence:** every handler repeats `const session = await getCurrentSession(); if (!session)
return 401`. 9 occurrences.
**Change:** add `withAuth(handler)` HOF in `lib/auth.ts` (and `withPublicHandler` for guest
routes) so identity, request-id, envelope and rate-limit metadata are uniform.
**Acceptance:** all handlers use the HOF; net line count drops; tests green.

### API-10 LOW — No method-not-allowed handling

**Evidence:** handlers export only their verb; Next returns 405 automatically but without the
envelope.
**Change:** where a route must reject a verb (e.g. GET on a POST-only route), export an
explicit `405` in envelope.
**Acceptance:** test asserts envelope 405.

---

## 5. WS-3 — Data Layer & RLS

### DB-01 HIGH — Privilege inventory is a probe, not a CI gate

**Evidence:** `supabase/probes/20260908_privilege_inventory.sql` exists but is not run in CI.
**Change:** add a `db-lint` CI job that applies migrations to an ephemeral Postgres and runs
every `supabase/tests/*.sql` + `probes/*.sql`, failing on drift.
**Acceptance:** CI job red on an intentionally loosened policy.

### DB-02 MEDIUM — Every `SECURITY DEFINER` function needs a pinned `search_path`

**Evidence:** many `*_atomic.sql` migrations define definer functions; a definer function
without `set search_path = ''` is a privilege-escalation vector.
**Change:** audit all definer functions; add `SET search_path = pg_catalog, public` (or `''`
with schema-qualified refs); add a probe asserting no definer function lacks it.
**Acceptance:** probe returns zero offenders.

### DB-03 MEDIUM — RLS policy coverage probe for _every_ user-scoped table

**Evidence:** `20260805003146_rls.sql` + later files add policies incrementally; no single
assertion that _every_ table with a `user_id`/`owner` column has RLS enabled.
**Change:** add `supabase/probes/rls_coverage.sql` listing tables without `relrowsecurity`
and each table's policy count; gate on it.
**Acceptance:** probe fails when a new table ships without RLS.

### DB-04 MEDIUM — Missing composite indexes for hot read paths

**Evidence:** `20260911010000_performance_indexes_and_analytics_schema.sql` exists — audit
which query shapes remain unindexed (chat thread keyset, discover filters, notification
inbox by `(user_id, read, created_at)`).
**Change:** add a timestamped migration with `EXPLAIN`-justified indexes; document each.
**Acceptance:** `EXPLAIN` shows index scans for the named queries.

### DB-05 HIGH — GDPR erase completeness must be table-enumerated and tested

**Evidence:** `services/gdpr/erase.ts`, migrations `20260906140000_gdpr_erase_events_coverage`
and `20260908010000_gdpr_erase_phased_terminal_state`; `supabase/tests/gdpr-erase-probe.sql`.
**Change:** generate the erase-coverage list from `information_schema` so a _new_ table with
user data fails the build until added to the erase map; extend the probe.
**Acceptance:** probe fails when a user-data table is added without erase handling.

### DB-06 MEDIUM — Add `updated_at` triggers + audit triggers uniformly

**Evidence:** `20260903030000_audit_log_canonical.sql` defines the audit log; confirm every
mutable table writes to it.
**Change:** central `audit_trigger()` applied per table; probe proves coverage.
**Acceptance:** probe + a write test asserts an audit row.

### DB-07 LOW — Soft-delete vs hard-delete consistency

**Evidence:** profiles have `suspended_at`; GDPR does hard erase. Confirm no table mixes
both semantics ambiguously.
**Change:** document the rule (suspend = soft, GDPR = hard) and add a lint probe.
**Acceptance:** probe.

### DB-08 MEDIUM — Seed/dev data must never reach prod

**Evidence:** `supabase/seeds/dev_data.local.sql`.
**Change:** guard seed with an env check + a CI assertion that the seed file is not in the
migration path.
**Acceptance:** CI test.

---

## 6. WS-4 — Domain Services

### CORE-01 MEDIUM — Search `token-rank.v1` is the only ranking; add relevance feedback loop

**Evidence:** `services/search/service.ts:32 SEARCH_ALGORITHM_VERSION = 'token-rank.v1'`.
**Change:** add a `search_impressions`/`search_clicks` signal (already have
`analytics_persistence`) and a `token-rank.v2` that boosts clicked profiles; keep the
version in the response (`SearchAlgorithmMeta`) for A/B.
**Acceptance:** unit test on rerank; version bump visible in API.

### CORE-02 MEDIUM — Matching reasons are computed but not surfaced

**Evidence:** `services/matching/reasons.ts`, `multi-*` files.
**Change:** expose `matchedReasons` in match DTOs and render as existing `Badge`/`Chip` in
`app/dashboard/matches` (WS-5).
**Acceptance:** DTO snapshot test; UI shows reasons.

### CORE-03 MEDIUM — Swipe daily quota exists in DB but is not surfaced in UI

**Evidence:** `20260915000000_swipe_daily_quota.sql`; UI has no "X left today" affordance.
**Change:** return remaining quota from `services/matching/*` and render a quota meter in the
existing Discover header (WS-5, no restyle).
**Acceptance:** service test; UI shows meter.

### CORE-04 MEDIUM — Notification digest/quiet hours not implemented

**Evidence:** `20260903060000_notification_preferences_matrix.sql` defines a preferences
matrix; `services/notifications/**` sends per-event only.
**Change:** add a digest task to the worker (`notification-digest`) that batches by the
matrix + respect quiet-hours windows stored per profile.
**Acceptance:** worker test produces one digest instead of N sends.

### CORE-05 MEDIUM — Chat: typing indicators / read receipts not in the realtime contract

**Evidence:** `lib/chat/*` + Ably; `20260916010000_message_reactions.sql` adds reactions.
**Change:** extend the transport-agnostic contract in `lib/chat/connection.ts` with
`typing`/`seen` events; wire in WS-5 chat.
**Acceptance:** contract type test; UI behaviour behind feature flag.

### CORE-06 MEDIUM — Ideas: no versioning or edit history

**Evidence:** `services/ideas/**` supports edit but not history.
**Change:** add `idea_revisions` table + `services/ideas/*` write-through; surface diff in
idea detail.
**Acceptance:** DB probe + service test.

### CORE-07 HIGH — Blocking is enforced in search but audit all read paths

**Evidence:** `services/search/service.ts:6 filterBlockedCandidates`; `services/safety/**`.
**Change:** assert _every_ candidate-returning service (discover, matching, connections,
ideas people) calls the block filter; add a shared `assertBlocksApplied` dev guard.
**Acceptance:** grep/test proves coverage.

### CORE-08 MEDIUM — Relationship-momentum is computed but under-used

**Evidence:** `lib/chat/momentum.ts`, `services/relationships/**`.
**Change:** surface momentum score in connections list and use it to rank suggestions.
**Acceptance:** ranking test.

### CORE-09 LOW — Service-level `Result` type instead of `throw` for expected failures

**Evidence:** services throw for expected domain failures, forcing handlers to catch broadly.
**Change:** introduce `Result<T, DomainError>` in `lib/errors.ts` for _expected_ outcomes;
reserve `throw` for programmer errors.
**Acceptance:** refactor one service + tests; adopt incrementally.

---

## 7. WS-5 — UI Feature Expansion (EXPANSION ONLY — never restyle)

> Every item below **adds** capability inside an existing shell. Nothing changes the visual
> language. New components use `components/ui` primitives and `--cx-*` tokens only.

### 7a — Shell / navigation (global)

#### UI-01 HIGH — Global command palette is faked but not wired

**Evidence:** `app/page.tsx:89` renders `<kbd>CMD K</kbd>` with no handler;
`hooks/use-keyboard-shortcut.ts` exists and is unused.
**Change:** build `components/layout/CommandPalette.tsx` (Dialog + Input + list, existing
primitives) driven by `useKeyboardShortcut(['mod','k'])`, searching via `client/api/search`.
Mount once in `app/layout.tsx` inside `VisualRouteFrame`.
**Acceptance:** CMD-K opens; typing searches; Enter navigates; Escape closes; a11y focus trap.

#### UI-02 HIGH — Real header is per-page duplicate; extract one `AppHeader`

**Evidence:** the same sticky header markup is copy-pasted in `app/dashboard/page.tsx:21-38`,
`app/dashboard/chat/page.tsx:26-36`, `app/dashboard/onboarding/page.tsx:22-32`, and ~15 other
dashboards, each with hard-coded "Good morning, Alex" and "AL".
**Why:** duplication blocks every global feature (notifications, search, avatar) and hard-codes
a fake identity.
**Change:** introduce `components/layout/AppHeader.tsx` (props only) and use it everywhere.
Bind identity to `store/auth.store.ts`. This is _refactor-to-existing-markup_ — the DOM the
user sees is identical.
**Acceptance:** visual snapshot (browser-automation) before/after shows no diff; all
dashboards import the shared header.

#### UI-03 MEDIUM — Notification centre is a static seed array

**Evidence:** `app/page.tsx:40-45 notificationSeed` hard-coded; real
`services/notifications/**` and `app/actions/notifications.ts` exist.
**Change:** wire the header bell to real notifications (`client/api/notifications.ts`
already exists); reuse the existing dialog markup exactly; add mark-read via the existing
action.
**Acceptance:** seeded DB shows real items; mark-read persists.

#### UI-04 MEDIUM — Mobile nav is duplicated inline; route to real pages

**Evidence:** `app/page.tsx:108` inline bottom nav; `components/layout/MobileNav.tsx` and
`config/navigation.ts` exist unused.
**Change:** use `MobileNav` + `mobileNavItems`; link to `ROUTES.*`.
**Acceptance:** tapping nav navigates; snapshot unchanged.

#### UI-05 MEDIUM — Breadcrumbs / back navigation missing on deep pages

**Evidence:** `components/layout/PageHeader.tsx` has eyebrow/title but no breadcrumb.
**Change:** extend `PageHeader` with optional `breadcrumbs` prop (existing Chip/Badge
primitives). No style change — additive.
**Acceptance:** deep pages show breadcrumbs; a11y `nav[aria-label="Breadcrumb"]`.

#### UI-06 LOW — Theme control is available but not exposed

**Evidence:** `ThemeProvider` is wired (`app/layout.tsx:95`); `dashboard/settings/appearance`
renders; but no quick toggle in header.
**Change:** add a theme toggle button to `AppHeader` (additive, uses existing tokens).
**Acceptance:** toggling changes theme; persists (`cx-theme`).

### 7b — Chat

#### UI-07 HIGH — Chat page uses static `threads`/`bubbles` arrays

**Evidence:** `app/dashboard/chat/page.tsx:11-21` hard-coded; `services/chat/**` +
`client/api/chat.ts` + Ably exist.
**Change:** load real threads/messages; keep the exact existing layout; add: message send via
`MessageComposer`, reactions (DB supports), read receipts, typing indicator (CORE-05),
attachment upload (storage bucket exists), search within thread (`20260903100000_message_search.sql`).
**Acceptance:** two browsers (Ably) see a live message; reactions persist; search returns.

#### UI-08 MEDIUM — `MessageComposer` is minimal

**Evidence:** `components/chat/MessageComposer.tsx` type-only contract.
**Change:** add emoji, attachment, send-on-enter, disabled/offline states using existing
primitives — no style change.
**Acceptance:** component tests.

#### UI-09 MEDIUM — Empty/loading/error states for chat threads

**Evidence:** `components/states/*` exist.
**Change:** wire `LoadingState`, `EmptyState`, `ErrorState` into chat list + thread.
**Acceptance:** simulated slow/failed fetch shows states.

### 7c — Events

#### UI-10 HIGH — Event registration funnel lacks guest + waitlist UX

**Evidence:** `app/events/[eventId]/page.tsx`; DB has waitlist
(`20260912040000_waitlist_promoted_notification.sql`) and `register_event_full`.
**Change:** add RSVP with seat counter, waitlist join + promoted banner, calendar `.ics`
export (`lib/calendar.ts` exists), share links — placed inside the existing event detail
layout.
**Acceptance:** RSVP increments seat; full event offers waitlist; `.ics` downloads.

#### UI-11 MEDIUM — Event discovery lacks saved filters & map view

**Evidence:** `app/events/search/page.tsx`, `app/events/category/[category]/page.tsx` exist;
`lib/filters/contract.ts` exists.
**Change:** persist filter state in the URL + localStorage; add a "near me" toggle that uses
`format-location` (no new map dependency — a list grouped by city, style-neutral).
**Acceptance:** filters survive reload; grouping renders.

#### UI-12 MEDIUM — Organizer analytics exists in API but not fully surfaced

**Evidence:** `app/events/[eventId]/analytics/page.tsx`,
`app/dashboard/events/[eventId]/analytics/page.tsx`, export API.
**Change:** surface viewsByDay/registrationsByDay as existing `Table`/`Tabs`; add the export
menu calling the export API.
**Acceptance:** charts/tables render real data; export downloads.

#### UI-13 LOW — Check-in flow for attendees

**Evidence:** `checkedInCount` in analytics; `app/dashboard/events/[eventId]/attendees`.
**Change:** add check-in toggle per attendee + QR (`qrcode` dep exists) for self-check-in.
**Acceptance:** toggling updates count.

### 7d — Ideas / Matches / Discover

#### UI-14 MEDIUM — Ideas need richer lifecycle UI

**Evidence:** `app/dashboard/ideas/**`; `services/ideas/**` supports join/review.
**Change:** add join-request review inbox (DB `idea_join_review_atomic`), collaborator list,
status badges, comments if supported.
**Acceptance:** owner approves a join -> collaborator appears.

#### UI-15 MEDIUM — Matches page lacks the "why" and actions

**Evidence:** `app/dashboard/matches/page.tsx`; reasons in `services/matching/reasons.ts`.
**Change:** show reasons (Chip), compatibility score, and direct actions (message / dismiss /
report) — placed inside existing card.
**Acceptance:** actions work; reasons display.

#### UI-16 MEDIUM — Discover swipe is not implemented on the real page

**Evidence:** `app/page.tsx` DiscoverView is a demo grid; `services/matching/swipe.schema.ts`

- `app/actions/swipe.ts` exist.
  **Change:** add a "stack" mode toggle (list vs card stack) to DiscoverView with swipe actions
  calling the real action; keep list view default.
  **Acceptance:** swipe persists via `perform_swipe`; quota meter (CORE-03) updates.

#### UI-17 LOW — Keyboard shortcuts beyond CMD-K

**Evidence:** `hooks/use-keyboard-shortcut.ts`.
**Change:** add `g d` (discover), `g e` (events), `?` (shortcut help), `/` (focus search),
with a help dialog.
**Acceptance:** shortcuts work; help dialog lists them.

### 7e — Profile / Settings

#### UI-18 MEDIUM — Profile editing is partial

**Evidence:** `app/dashboard/profile/edit/page.tsx`, `services/profiles/**`, LinkedIn
persistence; `provider_experiences`/`education`.
**Change:** add experience/education CRUD UI (add/edit/remove/reorder), skills, and a
completeness meter (`services/profiles/completeness.ts` exists) — inside existing form
layout.
**Acceptance:** CRUD persists; meter reflects completeness.

#### UI-19 MEDIUM — Settings pages are shells

**Evidence:** `app/dashboard/settings/{account,appearance,community,notifications,privacy,profile}`.
**Change:** wire each to real persistence: notification matrix, privacy flags, account
(email change, sessions list, MFA link), appearance (theme/density — additive).
**Acceptance:** toggles persist server-side.

#### UI-20 MEDIUM — Privacy page shows an `UnavailableState` for export

**Evidence:** `app/dashboard/settings/privacy/page.tsx:53-57` literally says the GDPR export
"isn't wired up yet".
**Change:** wire to `POST /api/gdpr/export` (after API-04) with a request button + status
list; add erase (danger zone) with typed confirmation.
**Acceptance:** export request creates a job; download link emailed.

### 7f — Public / Admin / Traction

#### UI-21 MEDIUM — Marketing browse/legal pages are thin

**Evidence:** `app/(marketing)/{browse,privacy,terms}/page.tsx`.
**Change:** expand browse to a real guest-gateway (`/api/browse`), add FAQ/security/DPA
sections, add a waitlist capture (DB has `waitlist_promoted_notification`).
**Acceptance:** guest browse shows real ideas/events; waitlist persists.

#### UI-22 HIGH — Admin console is a static shell of cards that link to `/dashboard`

**Evidence:** `app/admin/page.tsx:49 href="/dashboard"` — every module links to the same
dead end; `services/admin/service.ts` + moderation migrations exist.
**Change:** build real admin sub-pages: moderation queue (reports by priority
`20260906230000_report_priority.sql`), user search + suspend, event audit, denylist
(`lib/moderation/denylist.ts`), audit log viewer (`audit_log_canonical`). Keep the console
card grid; make each card go to its page.
**Acceptance:** each module loads real data; suspend works end-to-end.

---

## 8. WS-6 — Accessibility

### A11Y-01 HIGH — Dialog focus management & restore

**Evidence:** `app/page.tsx` composer & notifications use raw `role="dialog"` overlays at
lines 110-111 without focus trap/restore; `components/ui/dialog.tsx` exists — use it.
**Change:** migrate all inline dialogs to `ui/dialog` (focus trap, `aria-modal`, restore).
**Acceptance:** axe/manual: focus trapped, Escape closes, focus returns to trigger.

### A11Y-02 MEDIUM — Landmarks & heading order

**Evidence:** pages use `<main>` + `<header>` but `aside`/`nav` labels are inconsistent.
**Change:** assert one `<h1>` per page, labelled `nav`/`main`/`aside`.
**Acceptance:** axe landmark rules pass.

### A11Y-03 MEDIUM — Live-region announcements for async results

**Evidence:** toast (`sonner`) covers some; in-page results (search, RSVP) do not announce.
**Change:** add a shared `VisuallyHidden` live region (`components/a11y/VisuallyHidden.tsx`
exists) announced on search/RSVP/send.
**Acceptance:** screen-reader run announces.

### A11Y-04 MEDIUM — Colour-only status signalling

**Evidence:** badges/status use colour alone in several places.
**Change:** add text/icon to every colour-coded state (no visual change beyond an icon/label).
**Acceptance:** grayscale check.

### A11Y-05 MEDIUM — Focus-visible consistency

**Evidence:** `components/a11y/FocusRing.tsx` exists; many buttons rely on browser default.
**Change:** apply `FocusRing` to interactive primitives.
**Acceptance:** tab-through shows rings.

### A11Y-06 MEDIUM — Skip-to-content link

**Change:** add as first focusable element in `app/layout.tsx`.
**Acceptance:** first Tab reveals skip link.

### A11Y-07 MEDIUM — Keyboard operability of the swipe stack

**Evidence:** UI-16 introduces pointer gestures.
**Change:** provide keyboard/swipe-alternative buttons with labels.
**Acceptance:** all swipe actions reachable by keyboard.

### A11Y-08 LOW — `prefers-reduced-motion` coverage

**Evidence:** `lib/hooks/use-reduced-motion.ts`, `lib/motion.ts`, `cx-page-enter`.
**Change:** audit all animation entry points honour the hook.
**Acceptance:** reduced-motion run has no animation.

### A11Y-09 MEDIUM — Form error association

**Evidence:** forms use labels but not always `aria-describedby`/`aria-invalid`.
**Change:** standardise via the input primitives.
**Acceptance:** axe form rules pass.

---

## 9. WS-7 — Performance

### PERF-01 HIGH — `app/page.tsx` is a single large client component holding six views

**Evidence:** `app/page.tsx` `'use client'` renders Home/Discover/Connect/Messages/Ideas/
Events/Profile in one file.
**Why:** one huge client bundle; no route-level code splitting.
**Change:** split each view into its own lazily-loaded component (`next/dynamic`) and prefer
server components where data-driven; keep markup identical.
**Acceptance:** `next build` shows reduced first-load JS for `/`; snapshot unchanged.

### PERF-02 MEDIUM — `optimizePackageImports` covers only `lucide-react`

**Evidence:** `next.config.mjs:119`.
**Change:** add other barrels (`@sentry/nextjs` where applicable) after measuring.
**Acceptance:** bundle delta measured.

### PERF-03 MEDIUM — No `next/image` usage on remote avatars

**Evidence:** avatars are coloured `<div>`s / plain `<img>`.
**Change:** adopt `next/image` with the existing `remotePatterns` for real avatars.
**Acceptance:** Lighthouse image audit.

### PERF-04 MEDIUM — Search does in-DB ILIKE fallback with token rank in JS

**Evidence:** `services/search/service.ts` `MAX_DB_RESULTS = 100`.
**Change:** push ranking into a Postgres function or Meilisearch (`lib/meilisearch/**` exists)
behind `config/feature-flags.ts`; measure.
**Acceptance:** p95 latency improvement logged.

### PERF-05 MEDIUM — Cache layer under-used

**Evidence:** `lib/cache/**` + Redis exist; few call sites.
**Change:** cache public projections (`public_*` views) with short TTL + tag invalidation on
write; never cache per-user data (invariant).
**Acceptance:** cache hit-rate metric.

### PERF-06 LOW — Add `loading.tsx` per heavy route

**Evidence:** only root `app/loading.tsx`.
**Change:** add route-level `loading.tsx` using `components/states/LoadingState`.
**Acceptance:** Suspense fallback shows.

### PERF-07 MEDIUM — Database round-trips: batch N+1 reads

**Evidence:** candidate lists map to per-row lookups in some services.
**Change:** audit and batch with `in(...)`; add a query-counter test.
**Acceptance:** round-trip count drops.

### PERF-08 LOW — Adopt `Suspense` + streaming for dashboards

**Change:** stream slow panels; keep layout.
**Acceptance:** TTFB improves.

---

## 10. WS-8 — Observability & Ops

### OBS-01 HIGH — Sentry source maps are not wired

**Evidence:** README Known gaps #2; `sentry.*.config.ts` exist but no `withSentryConfig`.
**Change:** wrap `next.config.mjs` with `withSentryConfig` gated on `SENTRY_AUTH_TOKEN`;
set `SENTRY_ORG`/`SENTRY_PROJECT`; upload maps on build.
**Acceptance:** a thrown error shows a de-minified stack in Sentry.

### OBS-02 MEDIUM — `SENTRY_DSN` vs `NEXT_PUBLIC_SENTRY_DSN` mismatch

**Evidence:** `lib/observability.ts:82` checks `process.env.SENTRY_DSN`; `lib/env.ts:11` and
README reference `NEXT_PUBLIC_SENTRY_DSN`.
**Why:** captureError may never send because it checks the wrong variable.
**Change:** standardise on `SENTRY_DSN` (server) + `NEXT_PUBLIC_SENTRY_DSN` (client) and make
`captureError` check the _server_ one; document both in `.env.example`.
**Acceptance:** test asserts Sentry is called when the server DSN is set.

### OBS-03 MEDIUM — No metrics endpoint beyond health

**Change:** add `GET /api/metrics` (Prometheus text, worker-secret gated) exposing rate-limit
denials, queue depths, latency histograms.
**Acceptance:** scrape returns metrics.

### OBS-04 MEDIUM — Structured logs are not shipped anywhere

**Evidence:** `lib/logger.ts` writes to console only.
**Change:** add a pluggable sink (env `LOG_SINK=stdout|http`) so a collector can ingest; keep
console default.
**Acceptance:** sink config test.

### OBS-05 MEDIUM — No alert thresholds defined

**Change:** codify alert rules (readiness flap, 5xx rate, rate-limit spike) in `docs/RUNBOOK.md`

- (optionally) a `monitoring/` config.
  **Acceptance:** RUNBOOK updated.

### OBS-06 LOW — `x-request-id` propagation into logger context

**Change:** logger child per request (`logger.child({ requestId })`) in handlers.
**Acceptance:** every log line from a request carries the id.

### OBS-07 MEDIUM — Sentry `tracesSampleRate` hard-coded default

**Evidence:** `.env.example:36 SENTRY_TRACES_SAMPLE_RATE=0.1`.
**Change:** read it in `sentry.server/edge.config.ts` (env-driven).
**Acceptance:** env changes sample rate.

### OBS-08 LOW — Error boundaries should report

**Evidence:** `app/error.tsx`, `app/global-error.tsx` exist.
**Change:** call `captureError` inside them.
**Acceptance:** boundary error reaches Sentry.

---

## 11. WS-9 — DX / CI / Tests / Docs

### DX-01 HIGH — Test coverage is thin for backend (5 files)

**Evidence:** 47 tests cover `next-config`, `redirect`, `capabilities`, `observability`,
`validation`. Zero tests for `proxy.ts`, route handlers, or the 17 services.
**Change:** add Vitest suites for proxy gates, API envelopes, each service's pure logic, and
chat/notification/events. Target: every `services/**` file has a test or a documented reason.
**Acceptance:** coverage report; CI threshold.

### DX-02 MEDIUM — No coverage reporting / threshold

**Change:** add `@vitest/coverage-v8`, a `test:coverage` script, and a CI threshold.
**Acceptance:** CI fails below threshold.

### DX-03 MEDIUM — `npm run check` is not the CI gate (CI runs steps ad hoc)

**Evidence:** `package.json:21 check = lint && typecheck && test && build`; CI
`.github/workflows/ci.yml` runs lint/typecheck/test in one job and build in another.
**Change:** keep matrix but add a `check` job that calls the script so local == CI exactly.
**Acceptance:** CI job name matches script.

### DX-04 MEDIUM — `format:check` is not a CI gate

**Evidence:** README Known gaps #1 — Prettier `semi: false` disagrees with the corpus.
**Change:** run `npm run format` once in a dedicated commit, then add `format:check` to CI.
**Acceptance:** CI enforces formatting.

### DX-05 MEDIUM — No E2E tests

**Evidence:** only unit + SQL probes.
**Change:** add Playwright (or run the `browser-automation` skill in CI) for: login, browse
guest, create idea, RSVP, send message, GDPR export request.
**Acceptance:** E2E job green.

### DX-06 MEDIUM — No bundle-size budget

**Change:** add `@next/bundle-analyzer` + a CI size check.
**Acceptance:** CI fails on regression.

### DX-07 MEDIUM — No dependency update automation

**Change:** add Dependabot/Renovate config; group minor/patch.
**Acceptance:** PRs open.

### DX-08 MEDIUM — `npm audit` only in CI, no lockfile policy for advisories

**Change:** document triage SLA; add `npm audit --production` to pre-push hook.
**Acceptance:** hook.

### DX-09 LOW — No commit hooks

**Change:** add Husky + lint-staged (lint+build types on staged).
**Acceptance:** bad commit blocked.

### DX-10 MEDIUM — Docs drift: README claims CSRF verified (SEC-02) & counts

**Evidence:** README says 74 migrations; actual 93 SQL files. ARCHITECTURE says 74.
**Change:** make counts generated (a script) or remove brittle numbers; fix the CSRF claim.
**Acceptance:** docs match a generated inventory.

### DX-11 MEDIUM — No `CONTRIBUTING.md` / PR template / issue templates

**Change:** add them.
**Acceptance:** present.

### DX-12 LOW — `.editorconfig`/Prettier parity

**Change:** verify rules agree; document.
**Acceptance:** format idempotent.

### DX-13 MEDIUM — Missing `npm run db:*` helpers

**Change:** add scripts for migrate/seed/probe.
**Acceptance:** scripts run.

### DX-14 LOW — Local dev bootstrap script

**Change:** add a guided `scripts/setup.ps1`/`.sh`.
**Acceptance:** fresh clone runs.

---

## 12. WS-10 — SEO / PWA / Metadata

### SEO-01 HIGH — Per-route `metadata` is mostly absent

**Evidence:** only `app/layout.tsx` defines metadata; `app/events/[eventId]/page.tsx` etc.
have no `generateMetadata`.
**Change:** add `generateMetadata` for event/idea/profile public pages (title, description,
canonical, OG).
**Acceptance:** view-source shows unique tags.

### SEO-02 MEDIUM — No dynamic OG images

**Change:** add `app/api/og/route.tsx` (edge, `ImageResponse`) for event/idea share cards.
**Acceptance:** OG URL renders.

### SEO-03 MEDIUM — Sitemap excludes dynamic public pages

**Evidence:** `app/sitemap.ts` lists 5 static paths.
**Change:** include upcoming public events + public profiles (bounded).
**Acceptance:** sitemap includes dynamic entries.

### SEO-04 MEDIUM — `robots.ts` host uses origin-only

**Evidence:** `app/robots.ts:41 host: baseUrl`.
**Change:** confirm per RFC (host may need scheme); leave if intentional but document.
**Acceptance:** validator.

### SEO-05 MEDIUM — No `JSON-LD` structured data

**Change:** add `Event`/`Person`/`Organization` schema on public pages.
**Acceptance:** Rich Results test.

### SEO-06 MEDIUM — Manifest lacks screenshots/shortcuts parity

**Evidence:** `app/manifest.ts` shortcuts exist.
**Change:** add `screenshots`, `share_target`, real maskable icons.
**Acceptance:** Lighthouse PWA.

### SEO-07 LOW — PWA service worker / offline

**Change:** add a minimal SW for offline shell + push (notifications table exists).
**Acceptance:** offline page loads.

---

## 13. Cross-cutting risks & invariants

| Risk                                              | Mitigation                                                                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Parallel agents editing the same file             | File ownership table section 2; PR-per-workstream; no shared files without a lock.                                                         |
| Restyling creeps into "expansion" PRs             | Review checklist: no `globals.css` diff, no new colour literal, primitives only. Visual snapshot must be identical where the item says so. |
| CSP nonce rollout (SEC-07) breaks inline scripts  | Ship behind a staged flag; verify with browser-automation; never run two CSP headers.                                                      |
| CSRF rollout (SEC-02) breaks existing actions     | Implement `withCsrf` with an opt-out list during migration, then flip the default.                                                         |
| Trusted `x-user-*` headers (SEC-05)               | Ingress must strip; add defensive re-derivation + grep test.                                                                               |
| GDPR completeness (DB-05)                         | Schema-derived coverage; build fails on new user-data table.                                                                               |
| `next build` sharing `.next` across parallel work | Only the integrator runs `next build`; agents run `typecheck`/`test`/`lint`.                                                               |

---

## 14. Suggested execution order (phases)

1. **Phase 1 — Foundations (no UI risk).** WS-3 DB gates, WS-8 observability fixes, WS-1
   SEC-01/04/06, DX-01/02/03.
2. **Phase 2 — Contracts.** WS-2 API envelope + `withAuth`, WS-4 CORE-07 (blocks), then wire
   `client/api/http.ts`.
3. **Phase 3 — Dead-code & doc truth.** API-08, SEC-10, DX-10.
4. **Phase 4 — UI expansion.** WS-5 (split 5a-5e in parallel), WS-6 a11y in the same PRs.
5. **Phase 5 — Big controls.** SEC-02 CSRF, SEC-07 CSP nonce, SEC-09 Turnstile, SEC-12 MFA —
   each behind a flag with rollback.
6. **Phase 6 — Scale & polish.** WS-7 perf, WS-10 SEO, DX-05 E2E, OBS-01 source maps.

---

## 15. Definition of done (per item)

- [ ] Change implemented on the owning workstream branch only.
- [ ] Unit/contract test added and green (`npm run test`).
- [ ] `npm run typecheck` 0 errors, `npm run lint` 0 errors.
- [ ] If UI: verified with the `browser-automation` skill — no console errors, no failed
      requests, layout snapshot unchanged where the item requires it.
- [ ] If DB: timestamped migration + probe + `information_schema` coverage assertion.
- [ ] If a documented invariant changes: ARCHITECTURE/ADR updated in the same PR.
- [ ] No style/visual-language change beyond the explicitly additive element named in the item.
- [ ] README/docs counts and claims still true (or generated).

---

## 16. Full item index (quick reference)

**SEC** 01 CRITICAL constant-time bearer · 02 HIGH CSRF enforcement · 03 HIGH suspension cache ·
04 HIGH proxy double-call · 05 MED trusted headers · 06 MED rate-limit headers · 07 MED CSP nonce ·
08 MED CSP reporting · 09 MED Turnstile · 10 LOW dead security module · 11 MED attachment paths ·
12 MED MFA surfacing · 13 LOW error-path headers · 14 MED cookie hardening.

**API** 01 HIGH error envelope · 02 HIGH request-id on errors · 03 MED browse pagination ·
04 MED GET->POST GDPR · 05 HIGH idempotency keys · 06 MED export streaming · 07 MED export no-store ·
08 MED LinkedIn dead code · 09 HIGH auth HOF · 10 LOW 405 envelope.

**DB** 01 HIGH probes in CI · 02 MED definer search_path · 03 MED RLS coverage · 04 MED indexes ·
05 HIGH GDPR completeness · 06 MED audit triggers · 07 LOW delete semantics · 08 MED seed safety.

**CORE** 01 MED search v2 · 02 MED match reasons · 03 MED swipe quota UI · 04 MED digests ·
05 MED chat realtime · 06 MED idea history · 07 HIGH block coverage · 08 MED momentum · 09 LOW Result.

**UI** 01 HIGH CMD-K palette · 02 HIGH AppHeader · 03 MED real notifications · 04 MED MobileNav ·
05 MED breadcrumbs · 06 LOW theme toggle · 07 HIGH real chat · 08 MED composer · 09 MED chat states ·
10 HIGH RSVP/waitlist/ics · 11 MED filters · 12 MED analytics UI · 13 LOW check-in ·
14 MED ideas lifecycle · 15 MED matches why/actions · 16 MED real swipe · 17 LOW shortcuts ·
18 MED profile CRUD · 19 MED settings wiring · 20 MED GDPR UI · 21 MED public pages ·
22 HIGH admin console.

**A11Y** 01 HIGH dialog focus · 02 MED landmarks · 03 MED live regions · 04 MED colour-only ·
05 MED focus rings · 06 MED skip link · 07 MED keyboard swipe · 08 LOW reduced motion · 09 MED forms.

**PERF** 01 HIGH split homepage · 02 MED barrels · 03 MED next/image · 04 MED search engine ·
05 MED cache · 06 LOW route loading · 07 MED N+1 · 08 LOW streaming.

**OBS** 01 HIGH source maps · 02 MED DSN mismatch · 03 MED metrics · 04 MED log sink · 05 MED alerts ·
06 LOW request-id logger · 07 MED trace sample · 08 LOW boundaries.

**DX** 01 HIGH backend tests · 02 MED coverage · 03 MED check job · 04 MED format gate ·
05 MED E2E · 06 MED bundle budget · 07 MED deps automation · 08 MED audit policy · 09 LOW hooks ·
10 MED docs drift · 11 MED contributing · 12 LOW editorconfig · 13 MED db scripts · 14 LOW bootstrap.

**SEO** 01 HIGH per-route metadata · 02 MED dynamic OG · 03 MED dynamic sitemap · 04 MED robots host ·
05 MED JSON-LD · 06 MED manifest · 07 LOW service worker.

---

_This plan is EXPANSION-ONLY. Every UI item adds capability inside the existing design
system; any diff that changes the visual language fails review._

---

## 17. WS-11 — Frontend File-Structure Audit (structure quality, not style)

> **This section answers: "can the frontend file structure be improved?"**
> It is a *structural* audit — moving/creating/organising files and barrels. It changes
> **no visual output**. Every move is mechanical and compiler-verified. Because paths
> change, this workstream must run **alone** (no other WS in flight) and be one atomic
> commit per step, so `git revert` is always one step.

### 17.0 Ground truth — proposed tree vs. reality

The tree in the request describes a **target** architecture. Measured against the repo,
most of it **does not exist yet**. This table is the delta (verified by glob/grep, not
assumed):

| Proposed path | Reality today | Verdict |
| --- | --- | --- |
| `app/(marketing)/page.tsx` | **missing** — home is `app/page.tsx` | Move home into the group |
| `app/(auth)/login/page.tsx` | **no `(auth)` group**; `app/login/page.tsx` exists | Create group |
| `app/dashboard/layout.tsx` | **missing** — every dashboard re-renders its own header | **Create (highest value)** |
| `app/dashboard/settings/page.tsx` | **missing** — settings has only 6 sub-pages, no index | Create index |
| `app/events/page.tsx` | **missing** — only `search/`, `category/`, `[eventId]/` | Create index |
| `components/navigation/` | **does not exist** (RouteBack/RouteBreadcrumbs/RouteChrome) | Create |
| `components/forms/` | **does not exist** (FormSection/FormActions/FormError/ConfirmActionDialog) | Create |
| `components/motion/` | **does not exist** (Motion/Presence/Collapse/Pressable) | Create |
| `components/media/` | **does not exist** (AvatarWithFallback/AvatarStack/MediaFrame/ResponsiveMedia) | Create |
| `components/brand/` | exists but **only `Logo.tsx`** (no HeroConstellation/SignalLoader) | Extend |
| `components/a11y/` | exists but **only 3** (no `Announcer`, no `TouchTarget`) | Extend |
| `components/layout/index.ts` | **missing** — no barrel; 31 files import deep paths | Create barrel |
| `components/states/index.ts` | **missing** — imports go to `states/ErrorState` deep | Create barrel |
| `components/ui/index.ts` | **exists** (the only barrel in the repo) | Keep, expand |
| `features/discover,profile,matches,connections,chat,ideas,notifications,search,onboarding,settings` | **do not exist** — `features/` holds **only `events/`** (6 files) | Create, incrementally |
| `features/*/hooks`, `state/`, `types.ts` | **do not exist** anywhere | Create per context |
| `styles/{globals,tokens,animations}.css` | **no `styles/` dir** — only `app/globals.css` | Split OR keep (see below) |
| `store/{navigation,chat,discover}.store.ts` | **missing** — only `auth`, `ui`, `create-store` | Create |
| `hooks/use-debounce.ts` | **misplaced** — lives at `lib/hooks/useDebounce.ts` | Move |
| `hooks/use-local-storage.ts` | **misplaced** — lives at `lib/hooks/useLocalStorage.ts` | Move |
| `client/{api,query,websocket}/**` | exists (12 files) but **ZERO consumers** (grep: 0 imports) | **Wire or delete** |
| `types/*.ts` | exists (user/profile/event/match/message/database) — matches proposal | Keep |

**Two contradictions that matter more than the tree itself:**

1. **`client/**` is entirely dead.** `grep "from '@/client/"` → **0 results**. A 12-file
   data layer (`api/http.ts`, `query/keys.ts`, `query/client.ts`, `websocket/client.ts`,
   and 8 typed API modules) plus a full `query/keys.ts` key map exists and **nothing
   imports it**. Either it becomes the app's data layer (recommended — see STR-08) or it
   is deleted. Dead architecture is worse than no architecture: it lies to the reader.
2. **`AppShell` / `AuthenticatedShell` already exist and are unused.** Both are complete,
   typed, `'use client'` shells with `Header`/`MobileNav`/`DesktopNav`/`Container`/sidebar
   (`components/layout/AppShell.tsx:23`, `AuthenticatedShell.tsx:20`). Yet 18 dashboard
   pages **hand-roll their own sticky header**. The fix for UI-02 is *not* to invent an
   `AppHeader` — it is to **adopt the shells that already exist**.

### 17.1 Verdict on the proposed structure
**Score: 7.5 / 10 — direction is right, but it over-splits and mis-sequences.**

**What is correct and should be adopted:**
- ✅ Route *groups* (`(marketing)`, `(auth)`) — good; they let each surface carry its own
  layout/metadata without a shared wrapper.
- ✅ `app/dashboard/layout.tsx` — the single highest-value structural fix (kills 18 copies
  of the same header).
- ✅ `components/{ui,layout,states,a11y,brand,forms,motion,media,navigation}` — sensible
  axes; the *names* match the design system's intent.
- ✅ `features/<context>/{components,hooks,state,types}` — correct feature-slice shape.
- ✅ `hooks/` at root for *global* hooks — correct.
- ✅ `types/` shared, `client/` for browser data, `config/` for static config — correct.

**What is wrong and should be corrected in the plan:**

| # | Problem | Correction |
| --- | --- | --- |
| 1 | **Over-splitting `components/` into 10 folders for 34 files.** `media/` (4 named files, 0 exist), `motion/` (4 named, 0 exist), `forms/` (4 named, 0 exist) would each hold ≤4 files — folders that are *empty descriptions*, not structure. | Create a folder **only when the second consumer lands** (rule in §17.2). Start with `navigation/` (real duplication exists) and defer `media`/`motion`/`forms` until UI-10/UI-18 need them. |
| 2 | **`features/` for all 11 contexts at once.** Only `events/` exists. Creating 10 empty feature folders is the same anti-pattern. | Migrate **one context per PR**, driven by the UI items that need it (§17.3 order). |
| 3 | **`styles/{tokens,animations}.css` split.** Splitting CSS is a *style* change with real regression risk, and the plan's hard rule is *expansion only, never restyle*. | **Keep `app/globals.css` as-is.** If tokens must be reusable, extract them to a TS module (`config/tokens.ts`) for programmatic use, not a second CSS file. **Rejected on principle.** |
| 4 | **`(auth)/` group for a single route.** Today only `/login` is auth-candidate (`/callback` and `/logout` are route handlers). A group for 1 page is premature. | Move `login` into `(auth)/` **only when** signup/reset land (SEC-09 Turnstile adds signup). Until then, leave `app/login/`. |
| 5 | **`app/events/page.tsx` index.** Adding a public events *index* changes the marketing surface and needs SEO/robots review (WS-10). | Sequence it with SEO-03, not in the structural pass. |
| 6 | **`store/{navigation,chat,discover}`.** Client state should be *earned*. Currently only `auth`/`ui` are used. | Add a store only when a feature genuinely needs cross-component state (§17.2 rule). |

### 17.2 The structural rules (governance — apply to every future PR)

These make the structure **self-enforcing** rather than ceremonial:

- **RULE-S1 — Folders are earned, not planned.** Create a folder on the **second**
  consumer of a thing. One file alone is a file; two files is a folder.
- **RULE-S2 — One public door per module.** Every `components/<group>/` and
  `features/<ctx>/` gets an `index.ts` barrel; consumers import the group, never a deep
  file. (Today 31 files deep-import `components/states/ErrorState`; the barrel fixes this
  and makes a file move a one-line change.)
- **RULE-S3 — `app/` composes, `components/` renders, `features/` decides.** A route file
  may not contain business logic; a component may not import a service; a feature may not
  import another feature (cross-feature goes through `services/`).
- **RULE-S4 — Feature slice shape is fixed.** `features/<ctx>/{components,hooks,state,types.ts,index.ts}`
  — nothing else at the root of the slice; `utils.ts` allowed. No nested `features/a/features/b`.
- **RULE-S5 — No path drift.** All internal imports use the `@/` alias; no `../../..`.
  Add an ESLint `no-restricted-imports` rule to ban relative parent-traversal beyond one level.
- **RULE-S6 — Server/client boundary is explicit.** A client component's first line is
  `'use client'`; a feature slice exports server-safe code by default and marks client
  entry points with a `.client.tsx` suffix. (Today: `features/**` has **zero** `'use client'`,
  so the boundary is undefined.)

### 17.3 Target structure (revised, minimal, sequenced)

```
src/  (the repo root already plays the role of src/ — do NOT add a src/ wrapper; see STR-01)
│
├── app/
│   ├── layout.tsx                 # root: ThemeProvider + Toaster + VisualRouteFrame
│   ├── error.tsx not-found.tsx global-error.tsx loading.tsx
│   │
│   ├── (marketing)/               # NEW group — public, indexable
│   │   ├── layout.tsx             # NEW: marketing chrome (Footer etc.)
│   │   ├── page.tsx               # MOVED from app/page.tsx
│   │   ├── browse/ privacy/ terms/
│   │
│   ├── login/                     # stays until signup/reset exist (see STR correction #4)
│   │
│   ├── dashboard/
│   │   ├── layout.tsx             # NEW — THE keystone: AuthenticatedShell + real nav
│   │   ├── page.tsx
│   │   ├── chat/ connections/ matches/ notifications/ onboarding/
│   │   ├── profile/{edit,preview}/
│   │   ├── events/{new,[eventId]/{edit,attendees,analytics}}/
│   │   ├── ideas/{new,[ideaId]/edit}/
│   │   └── settings/              # NEW index page.tsx + existing 6 sub-pages
│   │
│   ├── events/                    # PUBLIC event UI (index deferred to SEO-03)
│   │   ├── search/ category/ [eventId]/{analytics}/
│   │
│   └── admin/ traction/ suspended/ settings/security/ legal/
│
├── components/
│   ├── ui/         index.ts       # primitives (existing) + barrel
│   ├── layout/     index.ts        # NEW barrel; adopt AppShell/AuthenticatedShell
│   ├── navigation/ index.ts       # NEW: RouteBreadcrumbs, RouteBack (real need: UI-05)
│   ├── states/     index.ts       # NEW barrel (LoadingState/EmptyState/ErrorState/...)
│   ├── brand/      index.ts       # Logo (+ SignalLoader when needed)
│   ├── a11y/       index.ts       # NEW barrel (+ Announcer, TouchTarget when needed)
│   ├── chat/                      # MessageComposer (feature-local today)
│   └── forms/ motion/ media/      # DEFERRED — created on 2nd consumer (RULE-S1)
│
├── features/                      # one slice per bounded context, migrated incrementally
│   ├── discover/  profile/  matches/  connections/  chat/  events/  ideas/
│   └── notifications/  search/  onboarding/  settings/
│       each: components/ hooks/ state/ types.ts index.ts
│
├── hooks/                         # GLOBAL hooks only
│   ├── use-mobile.ts use-media-query.ts use-keyboard-shortcut.ts
│   ├── use-intersection-observer.ts
│   └── use-debounce.ts use-local-storage.ts   # MOVED from lib/hooks/*
│
├── store/                         # client state (auth, ui) + earned additions
├── client/                        # browser data layer — MUST HAVE CONSUMERS (STR-08)
├── config/                        # routes, navigation, breakpoints, feature-flags
├── types/                         # shared domain types
├── utils/                         # pure helpers (cn, format-*)
├── lib/  services/  supabase/  tests/  proxy.ts  instrumentation*.ts
└── app/globals.css                # CSS stays here (split rejected — see correction #3)
```

### 17.4 Structural items
#### STR-01 MEDIUM — Do NOT introduce a `src/` wrapper
**Evidence:** the repo root is already the source root; `tsconfig.json` maps `@/*` → `./*`.
The proposed tree's `src/` prefix would require rewriting `@/` in ~500 files for zero gain.
**Change:** document that the **repo root is `src/`**; if a wrapper is ever wanted, do it once
in a dedicated migration PR with a codemod — never incrementally.
**Acceptance:** `tsconfig` unchanged; ADR note added.

#### STR-02 HIGH — Create `app/dashboard/layout.tsx` (keystone)
**Evidence:** missing today; 18 dashboard pages each hand-roll the sticky header
(`app/dashboard/page.tsx:21-38`, `chat/page.tsx:26-36`, `onboarding/page.tsx:22-32`, …),
while `components/layout/AuthenticatedShell.tsx` already implements exactly that chrome.
**Why:** this single file (a) removes ~18 duplicates, (b) gives one place to mount the
notifications bell (UI-03), command palette (UI-01), theme toggle (UI-06), breadcrumbs
(UI-05). It is the structural enabler for half of WS-5.
**Change:** add `app/dashboard/layout.tsx` rendering `<AuthenticatedShell>` with
`mainNavItems`/`secondaryNavItems` from `config/navigation.ts`; convert each dashboard page
body to a thin child. **Refactor-to-identical-markup** — the rendered DOM must not change.
**Acceptance:** browser-automation snapshot of `/dashboard`, `/dashboard/chat`,
`/dashboard/matches` **identical** before/after; `grep` shows zero duplicated `<header>`
blocks in `app/dashboard/**`.

#### STR-03 HIGH — Adopt the existing shells; do not invent `AppHeader`
**Evidence:** `AppShell.tsx` (59 lines) and `AuthenticatedShell.tsx` (50 lines) are complete
and unused; UI-02 proposed a new `AppHeader.tsx`.
**Change:** amend UI-02 to say *"adopt `AuthenticatedShell` via `app/dashboard/layout.tsx`"*
rather than *"create AppHeader"*. Keep `AppShell` for non-dashboard authenticated surfaces.
**Acceptance:** same as STR-02; no new duplicate header component exists.

#### STR-04 HIGH — Wire or delete `client/**` (dead 12-file data layer)
**Evidence:** `grep "from '@/client/"` → **0 results**, yet `client/api/*` (10 files),
`client/query/keys.ts`, `client/query/client.ts`, `client/websocket/client.ts` all exist.
**Why:** a data layer with no consumers misleads every reader and rots silently.
**Change:** choose one — **(A) adopt**: make feature hooks (UI-07 chat, UI-15 matches,
UI-03 notifications) fetch through `client/api/*` + `client/query/keys.ts`, making the
query-key map the single cache-key authority; or **(B) delete** the unused modules and keep
only what a consumer needs. **Recommend (A)** because `client/query/keys.ts` is a complete,
correct key design already.
**Acceptance:** either (A) 0 unresolved modules and ≥3 feature hooks import `@/client/...`,
or (B) `grep '@/client/'` → 0 and `client/` removed. No third state (dead code) allowed.

#### STR-05 HIGH — Add the missing barrels; ban deep cross-group imports
**Evidence:** only `components/ui/index.ts` exists. 31 files deep-import
`@/components/states/ErrorState`, `@/components/layout/PageHeader`, etc.
**Change:** add `index.ts` to `components/{layout,states,a11y,brand,navigation}`; add an
ESLint `no-restricted-imports` rule banning `@/components/<group>/<File>` depth ≥2; migrate
imports to the barrel.
**Acceptance:** lint rule active; `grep "@/components/states/"` → 0 (barrel only).

#### STR-06 MEDIUM — Move global hooks out of `lib/hooks/`
**Evidence:** `lib/hooks/useDebounce.ts`, `useLocalStorage.ts`, `use-reduced-motion.ts`,
`use-sound-preference.ts`, `use-haptics.ts` sit under `lib/`, while `hooks/` holds the other
4. Hook placement is split across two homes for no reason.
**Change:** move client-only hooks to `hooks/` with kebab-case names
(`use-debounce.ts`, `use-local-storage.ts`); keep anything runtime-neutral (if any) in `lib/`.
Update imports; keep both names exported during a deprecation window.
**Acceptance:** `grep 'lib/hooks'` → 0; `npm run typecheck` clean.

#### STR-07 MEDIUM — Migrate `features/*` one context per PR, in dependency order
**Evidence:** only `features/events/` exists (6 files).
**Change:** create each slice **when its UI item lands**, in this order:
`events` (exists) → `chat` (UI-07) → `matches` (UI-15) → `notifications` (UI-03) →
`ideas` (UI-14) → `discover` (UI-16) → `profile` (UI-18) → `settings` (UI-19) →
`search` (UI-01) → `onboarding` → `connections`.
**Acceptance:** after each PR, that context's components live only under
`features/<ctx>/components/`; its route file only composes.

#### STR-08 HIGH — Define and enforce the server/client boundary in features
**Evidence:** `features/**` has **zero** `'use client'` (grep) — the boundary is undefined,
so nothing stops a service import leaking into a client bundle.
**Change:** codify RULE-S6: client entry points are `<name>.client.tsx`; feature `index.ts`
re-exports only server-safe code; add an ESLint rule banning `services/**` imports from
any file under `features/**/components/**` unless it is `.client`-free.
**Acceptance:** a deliberate bad import fails lint.

#### STR-09 MEDIUM — Route-group the marketing surface (deferred parts noted)
**Evidence:** `app/(marketing)/` exists but **has no `page.tsx`** (home is `app/page.tsx`)
and no `layout.tsx` audit of chrome.
**Change:** move `app/page.tsx` → `app/(marketing)/page.tsx` **in the same PR as SEO-01**, so
metadata/canonical changes land together. Add `app/(marketing)/layout.tsx` only if the
marketing chrome differs from root (today it does not — so defer).
**Acceptance:** `/` still renders identically; sitemap/robots updated in the same PR.

#### STR-10 MEDIUM — `app/dashboard/settings/page.tsx` index
**Evidence:** settings has 6 sub-pages and **no index**, so the nav item `ROUTES.settings`
(`/dashboard/settings`) resolves to a 404 today.
**Change:** add a settings index that lists the existing cards (no restyle — reuse the
admin-console card grid pattern).
**Acceptance:** `/dashboard/settings` returns 200 and links to all 6 sub-pages.

#### STR-11 LOW — `app/events/page.tsx` public index
**Evidence:** `/events` does not exist; only `search/`, `category/[category]`, `[eventId]`.
**Change:** add a public events index; sequence with SEO-03 (sitemap) and robots review.
**Acceptance:** `/events` 200; sitemap includes it.

#### STR-12 MEDIUM — `config/navigation.ts` must match the route groups
**Evidence:** `mainNavItems` points Discover at `ROUTES.dashboard`; `secondaryNavItems` point
at `ROUTES.settings` (which 404s — STR-10) and `ROUTES.profile`.
**Change:** after STR-10, re-point nav items at real routes; add `count` wiring to the real
notification badge (UI-03).
**Acceptance:** every nav href returns 200; no dead links.

#### STR-13 LOW — Co-locate route-local components
**Evidence:** some routes define large inline view components (e.g. `app/page.tsx` holds
`HomeView`/`DiscoverView`/… in one file).
**Change:** when PERF-01 splits views, place each under
`features/<ctx>/components/` (per STR-07), leaving the route as a composition shell.
**Acceptance:** route files shrink to composition; views live in features.

#### STR-14 LOW — Add a structure test (guard against drift)
**Evidence:** nothing enforces the structure; it will decay.
**Change:** add `tests/structure.test.ts` asserting: no `app/**` file imports `services/**`
directly except via actions; no `features/a` imports `features/b`; every `components/<group>`
has an `index.ts`; no `lib/hooks/*` remains; no deep `@/components/x/y` imports.
**Acceptance:** test fails when a new violation is introduced.

### 17.5 What the structure gains (measured targets)

| Metric | Now | After WS-11 |
| --- | --- | --- |
| Duplicated dashboard `<header>` blocks | **18** | **0** |
| Files deep-importing a component file | **31** | **0** (barrels) |
| Dead data-layer files (`client/**`) | **12** | **0** (wired or gone) |
| Hook homes | **2** (`hooks/`, `lib/hooks/`) | **1** |
| `features/` contexts implemented | **1 / 11** | **11 / 11** (sequenced) |
| Component group barrels | **1** | **6** |
| Over-split empty folders | — | **0** (folders earned, RULE-S1) |
| 404 nav targets (`/dashboard/settings`) | **1+** | **0** |

---

## 18. WS-12 — "Even more advanced": capability frontier
> These are the highest-leverage things beyond the item lists above — the moves that make
> the product *feel* senior. Each is expansion-only and flagged with effort/impact.

### 18.1 Architecture & platform
| ID | Capability | Why it's advanced | Effort |
| --- | --- | --- | --- |
| ADV-01 | **Typed RPC end-to-end via `supabase gen types` in CI.** Regenerate `database.types.ts` on every migration and fail the build if it drifts. | Kills the entire class of "column renamed, app still compiles" bugs. | M |
| ADV-02 | **Route-level capability middleware.** A declarative `capability: 'manageEvents'` map consumed by `proxy.ts` + actions, generated from `services/auth/capabilities.ts`. | One table governs the whole app's authz; impossible to forget a gate. | M |
| ADV-03 | **OpenAPI/typed client generation for `app/api/**`.** Derive a schema from the zod validators already present; generate `client/api/*` types. | Makes the currently-dead `client/**` layer (STR-04) auto-correct. | L |
| ADV-04 | **Feature-flag service with server+client parity** (extend `config/feature-flags.ts` to env/Redis-backed, per-user cohorts). | Ships ADR-007 fail-closed semantics to every flag, not just integrations. | M |
| ADV-05 | **Edge-cached public projections.** `public_*` views + `s-maxage` + tag purge on write. | Public pages become CDN-static with correctness. | M |
| ADV-06 | **Contract tests between DB and DTOs.** For each `public_*` view, assert the SQL column set equals the TS DTO keys. | The seam where most real bugs hide. | M |
| ADV-07 | **Deterministic seed + snapshot DB for tests.** Apply migrations + seed into an ephemeral Postgres in CI (enables DB-01 and real E2E). | Unlocks DB-gated workstreams. | M |
| ADV-08 | **Codemod tooling (`ts-morph`) for structure migrations.** Automate barrel creation and import rewrites for WS-11. | Makes STR-05/06/07 safe and repeatable. | S |

### 18.2 Product intelligence
| ID | Capability | Why it's advanced | Effort |
| --- | --- | --- | --- |
| ADV-09 | **Match-quality feedback loop.** Log accept/dismiss/message outcomes; feed a `matching-v2` ranker. `services/matching/rerank.ts` already exists as the seam. | Turns matching from rules into learning. | L |
| ADV-10 | **Search relevance v2** (CORE-01) with click-through + synonym expansion; Meilisearch adapter already present. | Search that improves from use. | M |
| ADV-11 | **Relationship graph** — an explicit edges table + graph queries for "who should meet whom" (3-hop introductions). `services/relationships/**` is the base. | The product's actual moat (intent graph). | L |
| ADV-12 | **Reputation/trust signals** — verified attendance, response-time, completion rate; surfaced as badges. | Trust is the scarce resource in a matching product. | M |
| ADV-13 | **Smart digest** (CORE-04) using quiet-hours + ranking, not just batching. | Notification quality, not volume. | M |
| ADV-14 | **Calendar-sync (CalDAV/ICS in+out)** — `lib/calendar.ts` exists for ICS export. | Removes scheduling friction entirely. | M |
| ADV-15 | **AI-assisted profile/idea drafting** — behind a flag; *only* on user-submitted text, never auto-published. | Big activation lift, bounded by consent. | M |
| ADV-16 | **Onboarding as a measurable funnel** — `lib/analytics/funnel.ts` exists; wire step drop-off. | Makes the 6-step onboarding (STR/UI) optimisable. | S |

### 18.3 Frontend engineering craft
| ID | Capability | Why it's advanced | Effort |
| --- | --- | --- | --- |
| ADV-17 | **Optimistic UI everywhere** via the adopted `client/query` layer (STR-04) + `useOptimistic`. | Instant-feeling mutations, no spinner. | M |
| ADV-18 | **Server-driven UI for empty/error states** — one error-code → UI map from `lib/messages.ts`. | Consistent failures across 44 routes. | S |
| ADV-19 | **Design-token parity test** — assert `--cx-*` tokens used in TS classes exist in `globals.css`. | Prevents silent style rot *without* restyling. | S |
| ADV-20 | **Per-route Suspense skeletons** (PERF-06) + View Transitions API for nav. | Native-feeling transitions. | S |
| ADV-21 | **Command palette as action bus** (UI-01) — not just navigation but actions (create idea, RSVP). | One keyboard surface for the whole app. | M |
| ADV-22 | **Offline-first shell via service worker** (SEO-07) + cached public data. | PWA that actually works offline. | M |
| ADV-23 | **Text-scaling & RTL readiness** — logical properties + a `dir` audit. | Future-proofs a 44-route UI cheaply. | S |

### 18.4 Trust, safety & privacy (the "senior" differentiators)

| ID | Capability | Why it's advanced | Effort |
| --- | --- | --- | --- |
| ADV-24 | **Audit log viewer for users** — "where my data went", self-serve (built on `audit_log_canonical`). | Privacy as a feature, not a policy. | M |
| ADV-25 | **Data-processing inventory generated from schema** (extends DB-05). | GDPR-grade by construction. | M |
| ADV-26 | **Abuse-rate anomaly detection** — flag accounts whose report/block ratio spikes. | Safety that scales past manual moderation. | M |
| ADV-27 | **Session management UI** — list/revoke active sessions (needs `auth.sessions`). | Real account security (pairs with SEC-14). | S |
| ADV-28 | **Consent ledger** — versioned, timestamped consent per purpose; exportable. | The missing piece of most "GDPR-compliant" apps. | M |
| ADV-29 | **Content moderation pipeline with appeal path** — denylist + classifier + human review + appeal (`report_priority` exists). | Fair, auditable moderation. | L |

### 18.5 Operations & reliability
| ID | Capability | Why it's advanced | Effort |
| --- | --- | --- | --- |
| ADV-30 | **SLOs + error budgets** for readiness, p95 API, chat delivery. | Ops with a spine. | S |
| ADV-31 | **Load/soak test harness** (k6/autocannon) on the guest APIs + chat. | Know the cliff before users find it. | M |
| ADV-32 | **Canary + instant rollback** on deploy (Vercel/other). | Safe releases. | S |
| ADV-33 | **Chaos drills** — kill Redis, confirm fail-closed (ADR-007) holds in prod. | Proves the security posture. | S |
| ADV-34 | **Cost & query budgets** — per-route DB round-trip ceiling, enforced in tests. | Prevents silent N+1 regressions (extends PERF-07). | S |

### 18.6 The single highest-leverage trio (if you only do three)

1. **STR-02 + STR-03** — `app/dashboard/layout.tsx` adopting `AuthenticatedShell`.
   *Unblocks half of WS-5 and deletes 18 duplicates, with a provably identical DOM.*
2. **STR-04 + ADV-17** — adopt `client/**` as the real data layer with optimistic UI.
   *Turns a dead 12-file layer into the product's speed story.*
3. **ADV-01 + ADV-06** — generated DB types + DB↔DTO contract tests in CI.
   *Eliminates the bug class that costs the most time in a Supabase app.*

### 18.7 WS-11/WS-12 item index
**STR** 01 no `src/` wrapper (MED) · 02 dashboard layout keystone (HIGH) · 03 adopt existing shells (HIGH) ·
04 wire-or-delete `client/**` (HIGH) · 05 barrels + ban deep imports (HIGH) · 06 move global hooks (MED) ·
07 feature slices one per PR (MED) · 08 server/client boundary (HIGH) · 09 marketing route group (MED) ·
10 settings index (MED) · 11 public events index (LOW) · 12 nav matches routes (MED) ·
13 co-locate route views (LOW) · 14 structure guard test (LOW).

**ADV** 01 gen types · 02 capability middleware · 03 OpenAPI client · 04 flag service ·
05 edge cache · 06 DB↔DTO contracts · 07 snapshot DB · 08 codemods · 09 match feedback ·
10 search v2 · 11 relationship graph · 12 trust signals · 13 smart digest · 14 calendar sync ·
15 AI drafting · 16 onboarding funnel · 17 optimistic UI · 18 error→UI map · 19 token parity ·
20 transitions · 21 command bus · 22 offline PWA · 23 RTL/text-scale · 24 user audit log ·
25 processing inventory · 26 abuse anomaly · 27 session mgmt · 28 consent ledger ·
29 moderation pipeline · 30 SLOs · 31 load tests · 32 canary · 33 chaos drills · 34 cost budgets.

---
---

# ARCHIVE — Original audit & repair plan (superseded, kept for history)

## 1. Context

`C:\connect` contains a Next.js 16 app (App Router, Tailwind v4) whose **visual
layer** (`app/page.tsx`, `app/layout.tsx`, `app/globals.css`) renders a themed
"Connect" product (Discover / Events / Connect / Messages / Ideas / Profile).

A full **backend archive** was added on top:

- 12 Server Actions (`app/actions/*`)
- 11 API route handlers + `app/callback` + `app/logout` (`app/api/*`)
- Infrastructure `lib/*` (env, supabase, redis, ratelimit, auth, oauth, csrf,
  security, posthog, meilisearch, websocket/ably, chat, analytics, gdpr…)
- Domain services `services/*` (auth, matching, chat, profiles, ideas,
  relationships, connections, notifications, linkedin, alerts, safety, gdpr,
  search, feedback, admin, discover, matching, guest)
- Supabase migrations (~120), seed data, probes and tests
- `proxy.ts` → Next.js 16 proxy (middleware) with rate-limit + auth gates.
- `types/database.ts` + `supabase/database.types.ts`

## 2. Ground-truth findings (audited 21 Sep 2026)

1. **Dependencies missing.** `package.json` shipped with only the 8 UI deps;
   the backend imports ~15 more. Installed during audit (no source change):
   `zod @supabase/ssr @supabase/supabase-js @upstash/ratelimit @upstash/redis
ably clsx tailwind-merge meilisearch posthog-node qrcode resend speakeasy
@sentry/nextjs` and dev `vitest @types/qrcode @types/speakeasy`.
2. **Type errors (13, only).** `npx tsc --noEmit` reports exactly 13 errors in
   six files (see §4). Everything else already type-checks.
3. **Missing modules (3).** Imported but never shipped:
   - `@/features/events/factories/event-organizer.factory` (2 consumers)
   - `@/features/events/factories/event-analytics.factory` (2 consumers)
   - `@/components/chat/MessageComposer` (type-only import)
4. **Proxy paths that 404.** `proxy.ts` guards/redirects to `/login`,
   `/dashboard`, `/admin`, `/suspended`, `/traction`, `/settings/security`
   and `page.tsx` links to `/dashboard/events/new` — none of these pages exist.
5. **No `.env` scaffold and no test script**, so the stack cannot be run or
   verified reproducibly.
6. **Env is lazy-validated** (`lib/env.ts`) and integrations are optional —
   the app is designed to build without secrets and fail closed at runtime.

## 3. Objective

Audit and repair everything so the **whole codebase compiles, builds, and runs**
locally with **every route, action, service and visual path working**, while
keeping the theme/styling/CSS/placement defined by the three original frontend
files (`app/globals.css`, `app/layout.tsx`, `app/page.tsx`).

Success bar:

- `npx tsc --noEmit` → 0 errors.
- `npm run build` → passes.
- `npm run dev` → every page/API path served with no console errors;
  API routes return correct envelopes (auth → 401, invalid params → 400,
  guest-safe → 200).
- Visual homepage renders all six views with no regressions.

## 4. Repair workstreams (parallel agents)

### W1 — Homepage repair (owns: `app/page.tsx`)

Fix 2 type errors at `app\page.tsx:195` — comparisons `eventSpace === 'going'`
against the narrowed `'browse'` type in `EventsView`. Preserve all styling,
classnames, placement and behavior exactly. No other files.

### W2 — Events feature layer (owns: `features/events/**` — new)

Create the two missing factories plus their backing services, implemented
against Supabase (admin client) and the event/analytics schema in migrations:

- `features/events/factories/event-organizer.factory.ts`
  → creates `{ service: { getPermissions(eventId, userId) } }` returning
  `{ canViewAnalytics, canEdit, … }` (host/organizer check via `events`,
  `event_organizers`-style tables and `event_registrations`).
- `features/events/factories/event-analytics.factory.ts`
  → creates `{ service: { getEventAnalytics(eventId, userId) } }` returning the
  `EventAnalyticsDashboard` DTO the two API consumers expect.
  Consumers to satisfy (do not edit unless a contract mismatch demands it):
  `app/api/events/analytics/route.ts` and
  `app/api/events/[eventId]/analytics/export/route.ts`.
  Grounding references: `supabase/migrations/20260903010000_events_canonical_contract.sql`,
  `20260906240000_event_analytics_aggregate.sql`,
  `20260903040000_analytics_persistence.sql`, `types/database.ts`,
  `lib/supabase/admin.ts`, `lib/dto-events.ts`.

### W3 — LinkedIn route fixes (owns: `app/api/linkedin/**`)

- `app/api/linkedin/disconnect/route.ts` → replace invalid column
  `provider_origin` with the real column names on `profile_experiences` and
  `profile_experiences_education` per migration
  `20260912010000_profile_experiences.sql` + `types/database.ts`.
- `app/api/linkedin/sync/route.ts` → replace illegal `User → Record` casts
  (go through `unknown`, or map explicit fields).
  Grounding: `supabase/migrations/20260912000000_profile_provider_connections.sql`,
  `20260912010000_profile_experiences.sql`, `lib/supabase/admin.ts`,
  `services/linkedin/persistence.ts`.

### W4 — Chat composer type (owns: `components/chat/MessageComposer.tsx` — new)

Restore the module that `lib/chat/connection.ts` imports type-only from.
Must export `type ComposerConnectionState` with at least
`"online" | "reconnecting" | "connecting"` and keep the compile contract with
`lib/chat/connection.ts` and any chat actions. UI scope: minimal valid
component; the shipped homepage has its own Messages view and is untouched.

### W5 — Proxied pages (owns: `app/login`, `app/dashboard`, `app/admin`,

`app/suspended`, `app/traction`, `app/settings`)
Create themed pages so every `proxy.ts` redirect target and every in-app link
resolves. Use ONLY the existing design system (CSS vars `--cx-*` in
`app/globals.css`; lucide-react icons; no new deps). Root `app/layout.tsx`
already wraps all routes with ThemeProvider/Toaster — reuse it, do not edit.
Pages:

- `app/login/page.tsx` — branded auth landing (form UI; real auth action not
  required to render; keep client-safe).
- `app/dashboard/page.tsx` — post-login shell; safe fallback is a themed
  redirect to the main app (`/`) via `next/navigation`.
- `app/dashboard/events/new/page.tsx` — themed "create event" stub page.
- `app/admin/page.tsx` — themed admin shell (guarded content).
- `app/suspended/page.tsx` — themed suspended-account notice.
- `app/traction/page.tsx` — themed analytics/traction shell.
- `app/settings/security/page.tsx` — themed security settings shell.

### W6 — Integration & infra (owner: lead agent — NOT parallel)

After W1–W5 complete:

- Add `.env.example` documenting every public+server var from `lib/env.ts`
  (secrets redacted, placeholders only).
- Add npm scripts: `typecheck` (tsc --noEmit), `test` (vitest run); add
  minimal `vitest.config.ts` so `services/auth/capabilities.test.ts` runs.
- Audit module-scope imports that could throw at build time without env
  (posthog/meilisearch/ably/sentry/ratelimit) and guard them.
- Restart dev server, run `tsc`, `next build`, browser-verify every route.

## 5. Verification

- Global `npx tsc --noEmit` → 0 errors (run after W1–W5, iterate).
- `npm run build` clean.
- Browser automation (headless) over: `/`, `/login`, `/dashboard`,
  `/dashboard/events/new`, `/admin`, `/suspended`, `/traction`,
  `/settings/security`, `/api/browse`, `/api/search`, `/api/events/analytics`,
  `/api/linkedin/sync`, `/api/queue/worker`, `/callback`, `/logout` —
  assert no console errors, no failed requests, sane status codes.
- Homepage click-through of all six views.

## 6. Constraints / risks

- **No secrets**: runtime auth/redis/supabase calls fail closed without env —
  that is by design; `.env.example` documents what to fill.
- **Do not edit**: `app/layout.tsx`, `app/globals.css`, `package.json`
  (except W6 scripts), `proxy.ts`, and shared service files unless your
  workstream owns them.
- **No agents run `next build`** while parallel work is in flight (shares
  `.next`); the lead agent owns end-to-end builds.
- Parallel writes are disjoint by file ownership per workstream above.
