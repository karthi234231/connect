# Runbook

Operational guide for running, verifying and recovering Connect.
Audience: whoever is on call. Every command is copy-pasteable from the repository root.

---

## 1. Local run

```bash
npm ci                       # lockfile-exact install
copy .env.example .env.local # then fill the values (see README → Environment)
npm run dev                  # http://localhost:3000 (Turbopack)
```

Verify a fresh checkout end to end:

```bash
npm run check                # lint → typecheck → test → build
curl -s http://localhost:3000/api/health       | jq .
curl -s http://localhost:3000/api/health/ready | jq .
```

**Background dev server (Windows, non-interactive):**

```powershell
$p = Start-Process cmd.exe -ArgumentList '/c','npm run dev > dev-run.log 2> dev-run.err.log' `
     -WorkingDirectory 'c:\connect' -PassThru -WindowStyle Hidden
Set-Content devserver.pid $p.Id
Get-Content dev-run.err.log -Tail 40     # startup errors land here
```

Log files (`dev-server*.log`, `dev-run*.log`) are git-ignored working artefacts — read them,
do not commit them.

---

## 2. Health and readiness

| Probe | Use | Expected |
| --- | --- | --- |
| `GET /api/health` | Liveness (orchestrator restart decision) | Always `200` while the process serves HTTP. No dependencies are touched. |
| `GET /api/health/ready` | Readiness (load-balancer routing) | `200` ready · `503` not ready |

A `503` body lists `checks[]` with `status` (`ok` / `degraded` / `skipped` / `error`) and a
coarse `latencyMs`. `config.issueCount > 0` means the environment is incomplete.

**Interpretation**

| Symptom | Meaning | Action |
| --- | --- | --- |
| `supabase-auth: skipped` | `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` unset | Set them, redeploy |
| `supabase-db: error` | Service-role key invalid, or Postgres unreachable | Rotate/verify `SUPABASE_SERVICE_ROLE_KEY`, check project status |
| `redis: error` | Upstash unreachable | Check Upstash status + token; traffic will 429 while degraded |
| `config.issueCount > 0` in production | Env incomplete | Container reports `not_ready` deliberately — fix env, don't bypass the probe |

Every response carries `x-request-id`; quote it when escalating.

---

## 3. Common failures and first moves

| Symptom | Likely cause | First move |
| --- | --- | --- |
| `Missing or invalid environment variables` in logs | Env absent/typo'd | The log lists each offending **name**; values are never printed. Compare with `.env.example` |
| Every API returns `429` | Redis misconfigured → limiter fails closed | Check `UPSTASH_REDIS_REST_URL/TOKEN`; `/api/health/ready` → `redis` check |
| Page bounces to `/login?next=…` | No session (expected for gated routes) | Confirm cookie domain/`NEXT_PUBLIC_APP_URL` match the deployed origin |
| Bounce to `/suspended` | `profiles.suspended_at` set for that user | Confirm with the operator tooling before clearing |
| `/callback` → `/login?error=missing_code` | OAuth round-trip without a `code` | Restart the LinkedIn flow; verify provider redirect URI |
| Blank page + hydration error | Client/server branch mismatch | Check the browser console; CSP blocks appear as `Refused to …` |
| CSP blocks a new integration | Origin not allow-listed | Add it to `connect-src`/`img-src` in `next.config.mjs`, then add/extend a test in `tests/next-config.test.ts` |

---

## 4. Migrations

`supabase/migrations/` is append-only and timestamp-ordered (74 files at 1.0.0).

```bash
supabase migration new <descriptive_name>   # create the next file
supabase db push                            # apply pending migrations
supabase db reset                           # rebuild locally (destroys local data)
```

Rules:

1. **Never edit an applied migration.** Others have already run it; edit history diverges.
2. Multi-row invariants go in a `SECURITY DEFINER` function, not in client-side sequences.
3. Add a probe under `supabase/tests/` for any invariant that matters, and run it before
   merging.
4. Verify privileges after policy changes:
   `supabase/probes/20260908_privilege_inventory.sql`.

**Rollback** — write a forward migration that reverses the change. There is no down-migration
tooling by design; a reviewed forward fix is safer than an automated reversal.

---

## 5. Background work

```bash
curl -s -X POST https://<origin>/api/queue/worker \
  -H "Authorization: Bearer $WORKER_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"task":"notification-deliveries"}'
```

Tasks: `notification-deliveries`, `slack-alerts`, `analytics-flush`, or
`{"requestId":"<uuid>"}` to drain a GDPR job. A `401` means the bearer token is wrong or
`WORKER_SECRET` is unset (the endpoint fails closed). All tasks are idempotent — re-running
after a timeout is safe.

---

## 6. Incident checklist

1. **Confirm scope** — `GET /api/health` (process) then `/api/health/ready` (dependencies).
2. **Correlate** — grab `x-request-id` from the failing response and search logs.
3. **Classify** — configuration (env/probe), dependency (Supabase/Redis/Ably), or code.
4. **Mitigate** — fix env and redeploy; or stop routing traffic (`ready` already returns
   `503`) rather than serving degraded auth.
5. **Verify** — `/api/health/ready` → `200`, plus one authenticated page load and one
   mutation.
6. **Record** — add a `CHANGELOG.md` entry and, if a control failed, a regression test.

**Never** disable the auth gate, the suspension gate, rate limits or CSP to "get traffic
through" — all four are load-bearing for data protection.

---

## 7. Release procedure

```bash
npm run check                      # the full local gate must pass
npm version <major|minor|patch>    # updates package.json + creates the tag
# add a CHANGELOG.md entry, commit, push
```

CI must be green on **Node 20.x and 24.x** before promotion, with `npm audit` clean and
gitleaks reporting no findings.
