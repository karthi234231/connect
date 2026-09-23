# CONNECT — LinkedIn OAuth & Profile Data Setup (external runbook)

> **Audience.** The operator who owns the LinkedIn Developer app and the Supabase
> project. Nothing here is code changes — every step happens in the LinkedIn
> Developer portal, the Supabase dashboard, or `.env.local`.
>
> **Companion docs.** `docs/AUDIT_PLAN.md` (S05/S06 workstreams) describes the adapter's
> truthfulness contract; this runbook is the external half of that same contract.
>
> **Hard truth this runbook is built around:** LinkedIn's "Sign in with LinkedIn
> using OpenID Connect" product only returns **identity** claims (name, email,
> photo). Headline, experience and education are **separate, approval-gated
> products**. The app never invents data the grant did not return, so until those
> products are approved the profile edit page keeps LinkedIn experience/education
> read-only and the app stores only what the sign-in actually returns.

---

## 1. What the consent screen "authorize" means — and what each scope unlocks

When a user clicks **Continue with LinkedIn** the consent screen lists the
permissions this app requests. "Authorize" hands the app exactly those approved
permissions — nothing else. LinkedIn evaluates each requested scope against what
the Developer app's approved **products** allow; a scope not backed by an
approved product is not granted (the request is ignored or errors at the
provider).

| Requested scope  | What it unlocks                                                                             | Available with the standard sign-in product?                                                        |
| ---------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `openid`         | Stable subject id (`sub`) + `localizedFirstName` / `localizedLastName` on `/userinfo`       | **Yes** — identity only                                                                             |
| `profile`        | Same identity claims (OpenID `profile` claim set: name, localized name)                     | **Yes** — identity only                                                                             |
| `email`          | Primary email + `email_verified`                                                            | **Yes**                                                                                             |
| `r_basicprofile` | **Headline** (+ id / name / picture) via the classic v2 `/v2/me` response                   | **No** — requires the separate "Retrieve Basic profile data" product / legacy grant, approval-gated |
| `r_liteprofile`  | id / firstName / lastName / picture only (no headline, no location)                         | Legacy classic handshake; not an OIDC claim                                                         |
| `r_fullprofile`  | Legacy enrichments (positions/education via old v1 APIs) — separate product, approval-gated | **No** — separate product                                                                           |

**Bottom line today:** with the standard set (`openid profile email`) the app can
extract name, email and photo. It cannot extract headline, experience or
education until the LinkedIn app is additionally approved for the relevant
product — and even then the adapter only exposes profile (headline) through
`r_basicprofile`; experience/education are never fetched over HTTP (see section 5).

---

## 2. LinkedIn Developer app

1. Go to <https://developer.linkedin.com/> and create/select a **Developer app**
   (Apps → Create app). Sign in with the LinkedIn account that will own the app.
2. On the app's **Products** tab, add **"Sign in with LinkedIn using OpenID
   Connect"**. This is the only product the standard sign-in needs and the only
   one that returns identity claims.
   - Optional (for headline): add the **"Retrieve Basic profile data"** product
     (the OIDC-era grant for basic profile fields). It is a **separate,
     approval-gated** product — LinkedIn reviews and explicitly grants it. The
     older "Retrieve Full profile data" / legacy `r_fullprofile` grant is likewise
     separate and gated.
   - **Do not assume** adding the product grants the scope in production — verify
     on a test user and check LinkedIn's approval status.
3. In **Auth → Redirect URLs (OAuth 2.0 / OpenID Connect)** add the Supabase
   OAuth callback URL for every environment (dev + prod):
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
   (Supabase forwards to your app's `/callback` route via the `redirectTo` the
   login page sends.)
4. Note the app's **Client ID** and **Client Secret** (Auth → Credentials). The
   secret is shown once / regenerable — store it in the supabase secrets / `.env.local`.

> Because the standard sign-in product ships **identity only**, the app may also
> ask users to type in bio / looking-for / offering fields during profile setup.
> That is expected and honest: those fields are user-owned and cannot come from a
> not-yet-approved LinkedIn grant.

---

## 3. Supabase Dashboard (Authentication → Providers → LinkedIn (OIDC))

1. **Authentication → Providers → LinkedIn (OIDC)** → **Enable**.
2. Paste the LinkedIn app's **Client ID** and **Client Secret**.
3. Set the OIDC endpoints:
   - **Authorize URL:** `https://www.linkedin.com/oauth/v2/authorization`
   - **Token URL:** `https://www.linkedin.com/oauth/v2/accessToken`
   - **Userinfo URL:** `https://api.linkedin.com/v2/userinfo`
4. Set the requested **Scopes** (space-separated):
   ```
   openid profile email
   ```
   and, **only once the LinkedIn app is approved for it**, append `r_basicprofile`
   so the app can request the headline on sign-in:
   ```
   openid profile email r_basicprofile
   ```
   Keep the space-separated form identical to what the app requests (section 4) so
   the provider's declared scope list and your request list agree.
5. Set the **Site URL / Callback URL** in **Authentication → URL Configuration**:
   - Site URL: your production app URL (e.g. `https://app.example.com`).
   - Redirect URLs must include the Supabase callback above plus
     `http://localhost:3000/callback` for local dev (the app redirects through
     `/callback` after the exchange).
6. **provider_token security note.** Supabase returns the LinkedIn access token as
   `provider_token` on the client-visible session. It lets the app call the
   LinkedIn API, so:
   - Never log it (`lib/logger.ts` redacts keys named `*token*` — keep it that way).
   - Never persist it; the app only reads it from the in-memory session
     (`sessionAccessTokenProvider` in `services/linkedin/auth.ts`).
   - Treat it as short-lived credential: LinkedIn OIDC access tokens expire, and a
     revoked grant is classified `provider_revoked` — the user re-signs in.

---

## 4. App environment: `.env.local`

| Variable                | Required | Meaning                                                                                                                                      |
| ----------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `LINKEDIN_OAUTH_SCOPES` | optional | Space-separated LinkedIn OIDC scopes the app requests on sign-in. **Overrides** the scope list the login page forwards to `signInWithOAuth`. |

Behavior:

- **Unset / empty** → the app requests the identity-only default:
  ```
  openid profile email
  ```
- **Set to valid scopes** → the login page requests exactly that list. Example for
  headline (once the LinkedIn app is approved for the profile product):
  ```
  LINKEDIN_OAUTH_SCOPES="openid profile email r_basicprofile"
  ```
- **A typo / unknown scope** (anything outside `openid`, `profile`, `email`,
  `r_basicprofile`, `r_liteprofile`, `r_fullprofile`) → the app logs the offending
  scope and **falls back to the identity-only default** — identity sign-in never
  breaks, and the unknown scope is silently ignored at the provider.

The default is also baked into the client (`lib/oauth.ts`), so even if the server
is unreachable the sign-in flow still requests identity scopes. Keep the Supabase
dashboard scope list (section 3) in sync with this env value.

---

## 5. Honest limitations box

- **Experience and education cannot be extracted from the sign-in.** LinkedIn has
  no sign-in scope that returns employment/education history. The adapter
  (`services/linkedin`) supports them only from an **approved cache supply** — a
  data source the sign-in flow does not have. Until such a supply exists:
  - the post-login sync persists identity + headline (when granted) and **never**
    experience/education;
  - the profile edit page keeps LinkedIn-sourced experience/education **read-only**
    or absent;
  - the app **cannot** invent a headline, role, or school from scope presence or a
    guessed supply. "Not granted" renders as missing, never as fabricated data.
- **Headline** appears only when BOTH the LinkedIn app is approved for the basic
  profile product, the Supabase provider requests `r_basicprofile`, and LinkedIn
  actually declares it in the session's granted scopes. The adapter reconciles
  declared scopes — it never assumes a scope was granted.
- Sync failures never abort login: the callback runs the sync best-effort and the
  redirect proceeds regardless. Manual **Re-sync LinkedIn** (Account settings)
  reports the real provider result.
