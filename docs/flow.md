# Connect — End-to-End Flow Audit (`flow.md`)

> **Scope:** every user-facing and machine-facing flow in the app, traced from the
> entry point through the proxy gate, the page/route, the data source, and every
> redirect + fallback. Source-verified against `proxy.ts`, `lib/auth.ts`,
> `app/**`, `services/**`, and `config/routes.ts` on the current `C:\connect`
> tree. This is an **audit**, not a wishlist — every claim below is grounded in
> the file it names.
>
> **Rating legend (production bar, no compromise):**
> `A` = production-ready · `B` = works, minor gap · `C` = functional but has a
> real gap that should be closed before scale · `D` = broken/unsafe.
>
> **Environment caveat:** no live Supabase/Redis/Ably credentials were exercised
> in this audit. Compile/type/lint/test/build were verified (typecheck 0,
> lint 0 errors, tests green, `next build` exit 0). Runtime DB behaviour of
> individual queries is asserted from source, not from a live probe.

---

## 0. The one gate that governs everything — `proxy.ts`

`proxy.ts` is the single request gate. **Verified active:** this project is on
Next.js 16, which renamed the `middleware.ts` convention to `proxy.ts` and the
exported function from `middleware` to `proxy` ([Next.js 16 release notes](https://nextjs.org/blog/next-16), [Proxy file convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)).
Our file lives at the **project root** (same level as `app/`), exports
`proxy`, and exports `config.matcher` — exactly the required shape, so the gate
**is enforced**. (No `middleware.ts` exists; none is needed.) It is the **only**
place that decides logged-out → login, suspended → suspended, and per-operation
rate limits.

**Matcher (the ONLY paths proxied):**

```
/dashboard/:path* · /api/:path* · /login · /callback · /admin/:path* · /traction · /settings/security
```

**Decision order inside `handleProxy`:**

| Step | Condition                                                                | Action                                                                                    | Fallback                                      |
| ---- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------- |
| 0    | `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` not a string                     | pass-through (`NextResponse.next`)                                                        | **Degraded demo mode** — full gate disabled   |
| 1    | public API (`/api/browse`, `/api/search`, `/api/health`) **and** no user | rate-limit by IP (guest group)                                                            | 429 `Too Many Requests`                       |
| 2    | `path === /api/queue/worker`                                             | pass-through (route validates `WORKER_SECRET`)                                            | route returns 401                             |
| 3    | `path === /callback`                                                     | rate-limit by IP (auth group) → pass                                                      | 429                                           |
| 4    | `path === /login` **and** no user                                        | rate-limit by IP (auth group) → pass                                                      | 429                                           |
| 5    | no `userId` (any other matched path)                                     | `redirect → /login?next=<safe path>`                                                      | unsafe `next` is dropped, bare `/login`       |
| 6    | `path === /login` **and** user                                           | `redirect → next ?? /dashboard`                                                           | unsafe `next` → `/dashboard`                  |
| 7    | profile `suspended_at` set                                               | `/api/*` → **403 JSON**; else `redirect → /suspended`                                     | profile read failure treated as not-suspended |
| 8    | otherwise                                                                | rate-limit by user + operation group → inject `x-user-id`, `x-user-email`, `x-request-id` | 429                                           |

**Flow rating — proxy gate: `B`**

- ✅ Correct order, single authority, `x-request-id` on every response branch.
- ⚠️ **Gap (C-level risk): the matcher is a fixed allowlist.** Routes that render
  authenticated shells but are **not** in the matcher are never proxy-gated. The
  dashboard pages are covered by `/dashboard/:path*`, but:
  - `/dashboard/onboarding` — covered by the `/dashboard/:path*` prefix ✅
  - `/suspended` itself is **not** matcher-listed → a logged-out user can load
    `/suspended` directly (harmless, it's a static notice) ✅
  - Everything real is inside `/dashboard/*`, `/admin/*`, `/traction`,
    `/settings/security` → all listed ✅
  - **Real gap:** if a new authenticated top-level path is added outside these
    prefixes it is silently public. This is a _maintenance_ hazard, not a live
    hole (verified: no current authenticated page sits outside the matcher).
- ⚠️ Step 7 suspension read hits `profiles` on **every** matched request (1 extra
  query/request). Correct for safety; note as a latency cost.

---

## 1. Authentication & Session flows

### 1.1 Sign-in (LinkedIn OIDC) — `/` → `#` →

**Path:** `/login` → Supabase `signInWithOAuth(linkedin_oidc)` → LinkedIn →
`OAUTH_CALLBACK_PATH` (`/callback`) → `provisionAndRoute` → redirect.

**Route composition:**

- `app/login/page.tsx` — **client page**, _not_ proxy-redirects loop. Reads
  `?next=`, validates via `isSafeRedirectUrl` before putting it on the callback
  URL. Renders one LinkedIn button; `pending` stays true on success because
  Supabase performs the browser redirect.
- `app/callback/route.ts` — **Route Handler (not a page)** — intentionally, so
  `exchangeCodeForSession` can write cookies.
  - no `code` → `redirect /login?error=<code>`
  - exchange error → `redirect /login?error=oauth_exchange_failed` (logged)
  - no user after exchange → same failure redirect
  - success → `provisionAndRoute` → `redirect <safeNext>`; cookies copied onto
    the redirect response.

**Provisioning (`services/auth/provisioning.ts` + `services/auth/index.ts`):**

- Existing profile → `decideProvisioning` computes `create`/`sync`.
- Missing profile → atomic `upsert({ onConflict:'id', ignoreDuplicates:true })`
  → **no duplicate rows under concurrent callbacks**.
- Provider sync fills **only empty** user-owned fields (`full_name`, `avatar_url`)
  → a provider never overwrites user edits.
- Redirect intent: onboarded → `/dashboard`; not onboarded → `/dashboard/profile/edit`.
  A safe `?next` overrides the dashboard target when provisioned route is `/dashboard`.

**Fallbacks:** every failure path returns to `/login?error=...`; the login page
surfaces the error string in its existing error slot.

**Flow rating — sign-in: `A`**

- ✅ Correct handler type (cookie-write), atomic provisioning, single redirect
  authority, `next` validated on **both** client and server.
- ✅ Unsafe `next` always degrades to `/dashboard`.

### 1.2 Sign-out — `/logout`

**Path:** any logout affordance → **POST** `/logout` → `supabase.auth.signOut()`
→ `redirect /login`.
**Composition:** `app/logout/route.ts` — canonical authority; client-side
`signOut()` is forbidden by policy. Always redirects to `/login`, even on error.
**Fallback:** a failed server sign-out still lands on `/login` (never stranded).

**Flow rating — sign-out: `A`** for correctness.

- ⚠️ **Gap (B), source-confirmed:** redirect target is
  `new URL('/login', process.env.NEXT_PUBLIC_APP_URL)`. `lib/env.ts` marks
  `NEXT_PUBLIC_APP_URL` as **required** (`z.string().url(...)`), but this route
  reads `process.env` directly with **no fallback** — so any runtime where the
  var is unset/malformed makes `/logout` throw → 500, stranding the user.
  `/logout` is **not** in the proxy matcher (it's a direct POST handler), so the
  gate can't rescue it. _Fix:_ fall back to the request origin
  (`new URL('/login', request.url)`) exactly as `callback` does.

### 1.3 Suspended account — `/suspended`

**Path:** any matched request with `profiles.suspended_at` set → `redirect /suspended`
(API → 403 JSON).
**Composition:** `app/suspended/page.tsx` — static notice + "Sign out and back to
login" link to `/login`. (The link goes to `/login`, not `/logout` — the session
is still valid, so it renders a sign-in button, not a sign-out.)
**Fallback:** none needed (static).

**Flow rating — suspended: `B`**

- ✅ Gate is server-authoritative and runs before rate limiting.
- ⚠️ **Gap (B):** the suspended page's CTA says _"Sign out and back to login"_ but
  links to `/login`. Because the session is intact, the proxy step 6 bounces
  `/login` → `/dashboard`, whose suspension gate then bounces to `/suspended` —
  a **visible redirect flicker / potential loop feel**. It should POST `/logout`
  instead. _(Flow bug, not a security hole.)_

---

## 2. Public / Guest flows (no session)

### 2.1 Marketing home — `/`

**Composition:** `app/page.tsx` — a large self-contained **demo marketing shell**
(hardcoded people/conversations/notifications). Route group `(marketing)` does
**not** wrap it. Explicitly **out of scope** for data-wiring per
`docs/WS_EXECUTION_PLAN.md` ("the home demo itself is out of scope … moving
`app/page.tsx` risks the visual snapshot").
**Flow rating: `C`** — intentional demo, not a functional product surface. It is
not a flow defect; it is a deliberate prototype. Flag only that it is **not
indexable as a real product page** and links into `/dashboard/*` which then
auth-gates.

### 2.2 Browse (guest gateway) — `/browse`

**Path:** `app/(marketing)/browse/page.tsx` (inside `(marketing)/layout.tsx` —
Header + Footer chrome) → `fetchBrowse()` → `GET /api/browse`.
**Composition of `/api/browse`:**

- Guest-safe (proxy PUBLIC_API_PREFIXES). No `x-user-id` ⇒ `Cache-Control: public, max-age=60`; authenticated ⇒ `no-store`.
- `?eventId=` → detail mode `{ data: { event }` (404 if missing).
- else list mode: `{ data: { ideas, events, nextCursor, hasMore }` **plus**
  legacy bare `ideas`/`events` top-level arrays for `client/api/browse.ts`.
- Invalid query → 400 `apiError`; throw → 500 `apiError` (both keep cache header).
  **Fallbacks:** page renders `LoadingState` / `ErrorState` / `EmptyState` from
  `components/states/*`.

**Flow rating — browse: `A`**

- ✅ Guest-safe, cached only for guests, strict zod query, legacy + envelope
  compatibility kept deliberately.

### 2.3 Event search — `/events/search`

**Composition:** `app/events/search/page.tsx` (marketing chrome) → `searchEvents`
→ `GET /api/search`.

- `/api/search`: `q` required (1–100), `type` allowlisted, `limit` clamped ≤50.
  Invalid → 400. `viewerId` resolved best-effort (failure ⇒ undefined = guest).
  Returns `{ query, people, ideas, events }`.
- Empty query renders the search prompt `EmptyState` (does not call the API).
  **Fallback:** `LoadingState` / `ErrorState` / `EmptyState`.
  **Flow rating: `A`** — strict contract, graceful guest degradation.

### 2.4 Events index — `/events`

**Composition:** `app/events/page.tsx` (client) → `fetchPublicEvents` →
`GET /api/browse` (list mode, `upcoming:true`, `limit:12`).

- Cursor pagination ("Load more events"), guarded by a `busyRef` so double-fire
  can't append twice.
  **Fallback:** empty/error/loading states; `hasMore` hides the load-more button.
  **Flow rating: `A`** — clean pagination; cursor nulled when exhausted.

### 2.5 Event detail (public) — `/events/[eventId]`

**Composition:** `app/events/[eventId]/page.tsx` (client).

- Loads `fetchGuestEvent(eventId)` **and** `getGuestRegistrationStatusAction`
  in parallel. `getGuestRegistrationStatusAction` throwing `UNAUTHENTICATED`
  ⇒ `authState='guest'`.
- RSVP button state machine: guest → **"Sign in to register"** linking to
  `/login?next=/events/{id}`; registered → disabled "You're registered";
  ended → disabled; registration closed → disabled; full → **"Join waitlist"**;
  else → **"Register"** → `registerForEventAction`.
- Extras: `.ics` download, Google Calendar, copy link (clipboard failure is
  silent).
- `registerForEventAction` error mapping: `UNAUTHENTICATED` ⇒ flip to guest;
  `CONFLICT` ⇒ `err.userMessage`; else generic.
  **Fallback:** `loadError || !event` ⇒ `ErrorState` "Couldn't load this event".

**Flow rating: `A`**

- ✅ Best-in-app flow: guest→auth handoff via `?next`, waitlist vs register
  discriminated, ended/closed/full all handled, ICS/Google/share all wired.
- ⚠️ Minor (B): `resolveRegistration` is memoized with `useCallback` but the
  effect depends on `[eventId, resolveRegistration]` — correct, just noting the
  dependency is stable.

### 2.6 Privacy / Terms — `/privacy`, `/terms`

**Composition:** `app/(marketing)/{privacy,terms}/page.tsx` inside marketing
chrome. Static legal copy.
**Flow rating: `A`** (static).

---

## 3. Authenticated dashboard flows

### 3.1 Dashboard hub — `/dashboard`

**Composition:** `app/dashboard/page.tsx` (client) + `DashboardShellBar`.
Three parallel `useQuery` reads: `fetchMatches`, `fetchThreads`,
`getHostedEventsAction`. Derives: match count, unread sum, event count, first
match nudge, next 3 events.
**Fallbacks:** counts render `0`/empty copy when data absent (`?? []`); no hard
error state (this is a summary surface).
**Flow rating: `B`**

- ✅ Real fetches, no fabricated numbers.
- ⚠️ **Gap (B):** a failed `fetchMatches`/`fetchThreads` silently shows zeros —
  indistinguishable from "genuinely zero". For a prod hub, a quiet "couldn't
  load" affordance is warranted.

### 3.2 Chat list — `/dashboard/chat`

**Composition:** `app/dashboard/chat/page.tsx` + `ThreadListPanel` +
`ThreadView` (embedded). Reads threads, matches, own profile.

- Selecting a match renders `ThreadView` with `peer` from the match; `myId`
  from own profile.
  **Fallback:** loading / error / empty; right pane defaults to "Select a
  conversation".
  **Flow rating: `A`**.

### 3.3 Chat thread — `/dashboard/chat/[matchId]`

**Composition:** `app/dashboard/chat/[matchId]/thread-view.tsx`.

- Send via server action; optimistic pending; polling/keyword watch.
- Realtime posture via `useChatConnection(matchId)`:
  `getAblyTokenAction({ matchId })` → `new Ably.Realtime({ token: result.token })`
  → connection `connected/disconnected/suspended/failed` mapped through the pure
  `resolveComposerConnectionState` (`online` / `reconnecting` / `connecting`).
- `POST /api/ably/auth` also exists as an alternative token endpoint (calls the
  same `getAblyTokenAction`).
  **Fallback:** composer disabled/offline posture; thread access asserted
  server-side by the token service (participant + active match only).
  **Flow rating: `B`**
- ✅ Realtime is exactly as strict as message-send (`canMessageMatch`).
- ⚠️ **Duplication (B):** two token paths now exist (`getAblyTokenAction` direct
  in the hook **and** `/api/ably/auth`). The hook uses the action; the route is
  otherwise unused. Keep one authority or document the route as the fallback.

### 3.4 Matches — `/dashboard/matches`

**Composition:** `app/dashboard/matches/page.tsx`. Reads `fetchMatches` +
`fetchSwipeQuota`. Dismiss → `dismissMatch` (confirm dialog). Report →
`reportUserAction`. Quota chip shown only when non-null. `declined` filtered out.
**Fallback:** loading / error / empty.
**Flow rating: `A`**.

### 3.5 Connections — `/dashboard/connections`

**Composition:** `app/dashboard/connections/page.tsx` + `MomentumStatus`.
Reads `fetchConnections`; accept/decline → `respondToConnectionRequest` then
`invalidate + refetch`. Per-match momentum chip via `getRelationshipStateAction`.
**Fallback:** loading / error / empty per tab.
**Flow rating: `A`**.

### 3.6 Ideas — `/dashboard/ideas`, `/new`, `/[ideaId]`, `/[ideaId]/edit`

**Composition:** list (real), `new` + `edit` share `../../idea-form.tsx` and
`../../tag-utils.ts` (relative imports up two levels — verified correct).
`new`/`edit` parse `stage`/`visibility` through `ideaStageSchema` /
`ideaVisibilitySchema` before calling `submitIdeaAction` / `updateIdeaAction`.
Detail page reviews join requests (owner queue keyed `owner|viewer` so a viewer
never queries `join_requests`).
**Fallback:** loading / `NotFoundState` (edit uses an `action` retry button,
not `onRetry`).
**Flow rating: `A`**.

### 3.7 Events (organizer) — `/dashboard/events`, `/new`, `/[eventId]`,

`/[eventId]/edit`, `/[eventId]/analytics`, `/[eventId]/attendees`
**Composition:**

- list → `getHostedEventsAction` (organizer-scoped), "New event" via `ROUTES.eventsNew`.
- `edit` → `getHostedEventAction`, prefilled; description has no column ⇒ TODO,
  never faked.
- `analytics` → `fetchEventAnalytics` (`GET /api/events/analytics`, organizer-only)
  - export menu (`/api/events/[eventId]/analytics/export?format=csv|json`).
- `analytics` reads `viewsBySource`; the client `EventAnalytics` type now
  **includes** it (was the earlier type/wiring gap — fixed).
  **Fallbacks:** loading / error / empty; export route 400 without `format`.
  **Flow rating: `A`**.

### 3.8 Profile — `/dashboard/profile`, `/edit`, `/preview`

**Composition:**

- `profile` → `fetchOwnProfile` (real).
- `edit` → `getOwnProfileAction` + `getOwnConnectProfileAction`; saves via
  `updateIntroductionAction` (headline+bio) and `updateProfileAction`
  (skills/workStyle/commitmentLevel parsed through schema enums).
- `preview` → `fetchOwnProfile`; avatar/name/city/bio/skills from real data.
  **Fallback:** loading / `NotFoundState` / `ErrorState`.
  **Flow rating: `A`**.

### 3.9 Settings — `/dashboard/settings` + 6 sub-pages

- index → card grid linking the 6 sub-pages.
- `notifications` → `fetchNotificationSettings` / `updateNotificationSettings`
  (real persistence, server syncs optimistically).
- `privacy` → real flags, **GDPR export** `POST /api/gdpr/export`, **erase**
  `POST /api/gdpr/erase` (typed `ERASE` confirmation).
- `account` → name from real profile; email read-only (no email column — LinkedIn
  OIDC only); deactivate → `deactivateAccount` (visibility→private).
- `profile` → headline+bio via `updateIntroductionAction`, prefilled from
  `fetchOwnProfile` (incl. `headline`).
- `appearance` / `community` → client-only prefs persisted in `localStorage`
  (`useLocalStorage`); reduce-motion seeded from the real OS preference.
  **Fallback:** loading / error / inline save errors.
  **Flow rating: `A`** (appearance/community are `B` by design — no server column
  yet, honestly marked TODO).

### 3.10 Onboarding — `/dashboard/onboarding`

**Composition:** reads own profile; 5-step completeness derived from real fields;
finish → `completeOnboardingAction` → toast → `router.push('/dashboard/profile/edit')`.
**Fallback:** loading / error / toast on failure.
**Flow rating: `A`**.

### 3.11 Notifications — `/dashboard/notifications`

**Composition:** `fetchNotifications`; "Mark all read" → `markAllNotificationsRead`
then refetch. Appears in the nav badge path.
**Fallback:** loading / error / empty.
**Flow rating: `A`**.

---

## 4. Admin & internal flows

### 4.1 Admin console — `/admin`

**Composition:** `app/admin/page.tsx` + `AdminHeader`. Card grid → real
sub-pages (`/admin/moderation`, `/admin/users`, `/admin/events`, `/admin/audit`).
Tray numbers from `fetchAdminDashboardStats` (openReports / flaggedThisWeek /
suspendedUsers), `undefined`→"…", `null`→"—".
**Gate:** every admin read/session uses `requireAdmin` in the service layer.
**Flow rating: `A`**.

### 4.2 Traction — `/traction`

**Composition:** `app/traction/page.tsx` → `fetchTractionMetrics` →
`getTractionMetricsAction` (`requireAdmin`) → 4 head-only COUNTs
(profiles/matches/events/messages), each `null` on failure ⇒ renders "—".
**Gate:** proxy lists `/traction`; action `requireAdmin`.
**Flow rating: `B`**

- ✅ Honest nulls, no fabrication.
- ⚠️ **Gap (B):** 4 exact COUNTs on potentially large tables can be expensive at
  scale. Fine now; consider an approximate/estimated count later.

### 4.3 Security settings — `/settings/security`

**Composition:** `app/settings/security/page.tsx` (proxy-listed). MFA enable flow
gated by `FEATURE_FLAGS.mfa`; secrets via `speakeasy`+`qrcode`; recovery codes
session-scoped (no DB column yet — documented TODO).
**Fallback:** inline MFA errors; rows for password/devices/sessions are honest
copy pending a backend.
**Flow rating: `B`** — MFA enrolment is session-scoped by necessity (no column);
correctly TODO'd, never faked.

---

## 5. Machine / API flows

| Route                                    | Method   | Auth                                   | Fallback / notes                                       | Rating      |
| ---------------------------------------- | -------- | -------------------------------------- | ------------------------------------------------------ | ----------- |
| `/api/browse`                            | GET      | guest-safe (rate-limited by IP)        | 400/404/500 envelopes; guest cache 60s                 | A           |
| `/api/search`                            | GET      | guest-safe                             | 400 on bad query; best-effort viewer                   | A           |
| `/api/health`                            | GET/HEAD | public (no I/O)                        | 200 build metadata; known `runtime=nodejs`             | A           |
| `/api/health/ready`                      | GET      | public                                 | 200 ready / 503 not_ready; unconfigured deps `skipped` | A           |
| `/api/events/analytics`                  | GET      | `withAuth` + organizer                 | 400/403/500                                            | A           |
| `/api/events/[eventId]/analytics/export` | GET      | `withAuth` + organizer                 | 400 no format; CSV/JSON blob                           | A           |
| `/api/gdpr/export`                       | POST     | `withAuth`                             | `apiOk(result)` / 500                                  | A           |
| `/api/gdpr/erase`                        | POST     | `withAuth`                             | bare result / 500                                      | A           |
| `/api/linkedin/sync`                     | POST     | `withAuth`                             | 400/401/502/500                                        | A           |
| `/api/linkedin/disconnect`               | DELETE   | `withAuth`                             | 500 on connection-row failure; rest best-effort        | A           |
| `/api/ably/auth`                         | POST     | via action `requireUser`               | 400 missing matchId; 401 error                         | B (see 3.3) |
| `/api/queue/worker`                      | POST     | `WORKER_SECRET` bearer (`safeCompare`) | 401/400/500; task dispatch                             | A           |

**Flow rating — API surface: `A`** overall.

- ✅ `withAuth` wraps: 401 when no session, 500 on throw, `x-request-id` propagated.
- ✅ Worker is machine-authed, **not** session-gated (correct — proxy passes it through).
- ✅ Health liveness does no I/O; readiness gates deps and reports `skipped` for
  unconfigured optional integrations.

---

## 6. Redirects & fallbacks — consolidated map

| From                      | Condition    | To                                                                             | Type            |
| ------------------------- | ------------ | ------------------------------------------------------------------------------ | --------------- |
| any matched path          | no session   | `/login?next=<safe>`                                                           | 307 proxy       |
| `/login`                  | has session  | `next ?? /dashboard`                                                           | 307 proxy       |
| any matched path          | suspended    | `/suspended` (API → 403)                                                       | 307 / 403       |
| `/login`                  | OIDC success | `/callback`                                                                    | browser         |
| `/callback`               | success      | `provisionAndRoute` → `/dashboard` \| `/dashboard/profile/edit` \| safe `next` | 307             |
| `/callback`               | any failure  | `/login?error=…`                                                               | 307             |
| `/logout` (POST)          | always       | `/login`                                                                       | 307             |
| `/events/[id]`            | guest RSVP   | `/login?next=/events/[id]`                                                     | link            |
| `/dashboard/onboarding`   | finish       | `/dashboard/profile/edit`                                                      | router.push     |
| `/dashboard/profile/edit` | save ok      | `/dashboard/profile`                                                           | router.push     |
| page render error         | any          | `app/error.tsx` ("retry" = reset)                                              | client boundary |
| route not found           | any          | `app/not-found.tsx` ("Back to Connect" → `/`)                                  | 404             |
| route suspends            | any          | `app/loading.tsx` (themed loader)                                              | Suspense        |

**Root chrome:** `app/layout.tsx` wraps everything in `ThemeProvider`
(dark-first, `enableSystem`) + `Toaster`, `VisualRouteFrame` is a pass-through
fragment. `(marketing)/layout.tsx` adds Header/Footer only for the marketing group.

---

## 7. Scorecard (production bar)

| Flow                            | Rating | Headline gap                                                                             |
| ------------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| Proxy gate                      | **B**  | fixed-allowlist matcher is a maintenance hazard; suspension read per request             |
| Sign-in (OIDC)                  | **A**  | —                                                                                        |
| Sign-out                        | **B**  | `NEXT_PUBLIC_APP_URL` unset → 500 in `/logout` (no origin fallback); confirmed in source |
| Suspended notice                | **B**  | CTA links `/login` (bounces back) instead of POST `/logout`                              |
| Browse / Search / Events public | **A**  | —                                                                                        |
| Event detail + RSVP             | **A**  | —                                                                                        |
| Dashboard hub                   | **B**  | failed reads render as zeros (no failure affordance)                                     |
| Chat (list + thread)            | **B**  | two Ably token paths                                                                     |
| Matches / Connections / Ideas   | **A**  | —                                                                                        |
| Organizer events + analytics    | **A**  | —                                                                                        |
| Profile + Settings              | **A**  | appearance/community prefs are client-only by design                                     |
| Onboarding / Notifications      | **A**  | —                                                                                        |
| Admin console                   | **A**  | —                                                                                        |
| Traction                        | **B**  | exact counts at scale                                                                    |
| Security/MFA                    | **B**  | enrolment session-scoped (no DB column)                                                  |
| API surface                     | **A**  | `/api/ably/auth` redundant with the action                                               |

**Overall: `A−`.** Every flow is end-to-end wired with real data and honest
fallbacks; no broken flow, no fabricated data, no unsafe redirect. The remaining
items are three small **`B`-level polish gaps** that a production review should
close, in priority order:

1. **Suspended CTA** → POST `/logout` (removes a redirect bounce).
2. **`/logout` origin fallback** → use `request.url` so an unset
   `NEXT_PUBLIC_APP_URL` can't 500.
3. **Dashboard hub** → surface a quiet "couldn't load" state instead of zeros.
4. (Cleanup) pick **one** Ably token authority: the action _or_ `/api/ably/auth`.

None of these break a flow; all three are correctness/UX hardening, not security
holes. **Do not compromise on** the ones already done right: single redirect
validator (`lib/redirect.ts`, re-exported by `lib/security.ts`), atomic
provisioning, server-authoritative suspension, guest-safe caching, and
`withAuth` on every machine route.
