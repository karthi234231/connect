#!/usr/bin/env node
// scripts/linkedin-login.mjs — operator CLI: drive the real LinkedIn OAuth
// sign-in end to end against the running app, then cache the authenticated
// browser session for reuse.
//
// Why this exists: Connect has no password form — LinkedIn OAuth is the only
// sign-in path (app/login/page.tsx). Playwright therefore cannot seed auth
// state from credentials alone; this script performs the handshake once
//   /login → Supabase auth-ui → LinkedIn consent → /callback → /dashboard/discover
// and persists the resulting cookies + localStorage to playwright/.auth/ so
// subsequent runs (and tests/e2e) can boot already signed in.
//
// Secrets policy: credentials are NEVER committed. They are read from the
// gitignored .env.local (LINKEDIN_TEST_EMAIL / LINKEDIN_TEST_PASSWORD) or the
// ambient environment. See .env.example for the documented key names.
//
// Usage:
//   node scripts/linkedin-login.mjs                 # headed (LinkedIn blocks headless)
//   node scripts/linkedin-login.mjs --headless      # best effort, likely challenged
//   node scripts/linkedin-login.mjs --url http://localhost:3000
//   node scripts/linkedin-login.mjs --out playwright/.auth/state.json
//   node scripts/linkedin-login.mjs --timeout 900000 --keep-open
//
// Device trust: the run uses a persistent Chromium profile (--profile,
// default .playwright-profile, gitignored). LinkedIn's one-time security
// checkpoint (PIN / email verification) therefore only has to be solved once;
// later runs reuse the trusted-device cookie and go straight through.
//
// Exit codes: 0 signed in · 1 failure · 2 missing credentials/config.

import { chromium } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_OUT = 'playwright/.auth/linkedin.json'
const DEFAULT_URL = 'http://localhost:3000'
const DEFAULT_TIMEOUT = 180_000
const DEFAULT_PROFILE = '.playwright-profile'
const SHOT_DIR = 'test-results'

// ── dotenv-lite ───────────────────────────────────────────────────────────
// Deliberately dependency-free: the repo ships no dotenv package, and
// `next dev` already loads .env.local for the app itself. Only KEY=VALUE,
// quotes and `#` comments are supported — enough for local operator tooling.
function loadEnvFile(file) {
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key] !== undefined) continue // ambient env wins
    let value = rawValue.trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    } else {
      value = value.replace(/\s+#.*$/, '').trim()
    }
    process.env[key] = value
  }
}

function parseArgs(argv) {
  const opts = {
    url: DEFAULT_URL,
    out: DEFAULT_OUT,
    profile: DEFAULT_PROFILE,
    timeout: DEFAULT_TIMEOUT,
    headless: false,
    keepOpen: false,
    slowMo: 0,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = () => argv[++i]
    switch (arg) {
      case '--url':
        opts.url = next()
        break
      case '--out':
        opts.out = next()
        break
      case '--profile':
        opts.profile = next()
        break
      case '--timeout':
        opts.timeout = Number(next())
        break
      case '--slow-mo':
        opts.slowMo = Number(next())
        break
      case '--headless':
        opts.headless = true
        break
      case '--headed':
        opts.headless = false
        break
      case '--keep-open':
        opts.keepOpen = true
        break
      case '--help':
      case '-h':
        console.log(
          'usage: node scripts/linkedin-login.mjs [--url origin] [--out path]\n' +
            '                                   [--profile dir] [--timeout ms]\n' +
            '                                   [--headless] [--keep-open]\n' +
            '                                   [--slow-mo ms]',
        )
        process.exit(0)
        break
      default:
        console.error(`unknown flag: ${arg} (try --help)`)
        process.exit(2)
    }
  }
  return opts
}

// ── logging ───────────────────────────────────────────────────────────────
const started = Date.now()
const stamp = () => `${((Date.now() - started) / 1000).toFixed(1)}s`
const log = (icon, message) => console.log(`${icon} [${stamp()}] ${message}`)
const step = (message) => log('▸', message)
const ok = (message) => log('✔', message)
const warn = (message) => log('!', message)
const fail = (message) => log('✖', message)

async function runStep(label, fn) {
  const at = Date.now()
  step(label)
  const result = await fn()
  ok(`${label} (${Date.now() - at}ms)`)
  return result
}

// ── browser helpers ───────────────────────────────────────────────────────
/** Click the first selector that becomes visible, or throw with context. */
async function clickAny(page, selectors, label, timeout = 20_000) {
  const perSelector = Math.max(2_000, Math.floor(timeout / selectors.length))
  for (const selector of selectors) {
    const target = page.locator(selector).first()
    try {
      await target.waitFor({ state: 'visible', timeout: perSelector })
      await target.click({ timeout: perSelector })
      return selector
    } catch {
      // try the next candidate
    }
  }
  throw new Error(`could not find ${label}; tried: ${selectors.join(' | ')}`)
}

/** True when any selector in the list is currently visible. */
async function anyVisible(page, selectors, timeout = 1_500) {
  for (const selector of selectors) {
    try {
      if (await page.locator(selector).first().isVisible({ timeout })) {
        return true
      }
    } catch {
      // keep scanning
    }
  }
  return false
}

/** Annotate the window so it is obvious which run owns it. */
async function tagWindow(context, label) {
  await context.addInitScript((text) => {
    window.addEventListener('DOMContentLoaded', () => {
      document.title = `${text} · ${document.title}`
    })
  }, label)
}

// ── LinkedIn page knowledge ───────────────────────────────────────────────
const EMAIL_INPUTS = [
  '#username',
  'input[name="session_key"]',
  'input[type="email"]',
  'input[autocomplete="username"]',
]
const PASSWORD_INPUTS = [
  '#password',
  'input[name="session_password"]',
  'input[type="password"]',
  'input[autocomplete="current-password"]',
]
const SUBMIT_BUTTONS = [
  'button[type="submit"]',
  'button[data-litms-control-urn="login-submit"]',
  'button.btn__primary--large',
  'button:has-text("Sign in")',
]
const CONSENT_BUTTONS = [
  'button[data-test-id="oauth2-consent-page-allow"]',
  'button#oauth2-consent-page-allow',
  'input[name="action"][value*="Allow"]',
  'button:has-text("Allow")',
  'button:has-text("Agree")',
  'button:has-text("Accept")',
  'button[type="submit"]',
]
const CHALLENGE_HINTS = [
  '#error-for-password',
  'input[name="pin"]',
  'input[id*="verification"]',
  'form[action*="checkpoint"]',
]
// Rendered only when LinkedIn actively rejects the submitted credentials —
// distinct from a security checkpoint, which the operator must clear by hand.
const BAD_CREDENTIAL_HINTS = [
  '#error-for-password',
  '#error-for-username',
  '.form__label--error',
  '[role="alert"]:has-text("password")',
  '[role="alert"]:has-text("couldn\'t find")',
  'text=Please enter a valid password',
  "text=That doesn't match",
]
// ── sign-in flow ──────────────────────────────────────────────────────────
/** Fill the first selector that becomes visible, or throw with context. */
async function fillAny(page, selectors, value, label, timeout = 20_000) {
  const perSelector = Math.max(2_000, Math.floor(timeout / selectors.length))
  for (const selector of selectors) {
    const target = page.locator(selector).first()
    try {
      await target.waitFor({ state: 'visible', timeout: perSelector })
      await target.fill(value, { timeout: perSelector })
      return selector
    } catch {
      // try the next candidate
    }
  }
  throw new Error(`could not fill ${label}; tried: ${selectors.join(' | ')}`)
}

/** Submit the LinkedIn credential form and report credential-level failures. */
async function submitLinkedInCredentials(page, email, password) {
  await fillAny(page, EMAIL_INPUTS, email, 'LinkedIn email field')
  await fillAny(page, PASSWORD_INPUTS, password, 'LinkedIn password field')

  const previousUrl = page.url()
  await clickAny(page, SUBMIT_BUTTONS, 'LinkedIn submit button')

  // Give LinkedIn a moment to answer; a same-page settle means it rejected us.
  await page
    .waitForURL((url) => url.toString() !== previousUrl, { timeout: 20_000 })
    .catch(() => {})

  if (/linkedin\.com\/(login|uas\/login)/.test(page.url())) {
    if (await anyVisible(page, BAD_CREDENTIAL_HINTS, 2_000)) {
      throw new Error(
        `LinkedIn rejected the credentials for "${email}" (the login form still shows an error).`,
      )
    }
  }
}

/**
 * Drive LinkedIn → Supabase → app until we land back inside the app origin.
 * Consent pages are clicked automatically; security challenges (PIN / email
 * verification) cannot be automated, so the run parks and lets the operator
 * finish inside the visible window before continuing.
 */
async function completeHandshake(page, { origin, email, password, timeout }) {
  const deadline = Date.now() + timeout
  let credentialsSubmitted = false
  let consentClicked = false
  let challengeNotified = false
  let lastUrl = ''

  while (Date.now() < deadline) {
    const url = page.url()
    if (url !== lastUrl) {
      step(`browser at ${url}`)
      lastUrl = url
    }

    // 1. Landed back inside the app (callback bounces straight to Discover).
    if (url.startsWith(origin) && !url.includes('/login')) {
      return url
    }

    // 2. LinkedIn credential form.
    if (!credentialsSubmitted && /linkedin\.com/.test(url)) {
      if (await anyVisible(page, EMAIL_INPUTS, 2_500)) {
        await submitLinkedInCredentials(page, email, password)
        credentialsSubmitted = true
        continue
      }
    }

    // 3. OAuth consent ("Allow / Agree & Continue").
    if (!consentClicked && /linkedin\.com/.test(url)) {
      if (await anyVisible(page, CONSENT_BUTTONS, 2_500)) {
        const selector = await clickAny(
          page,
          CONSENT_BUTTONS,
          'LinkedIn consent button',
        )
        ok(`granted consent via ${selector}`)
        consentClicked = true
        continue
      }
    }

    // 4. Human-only checkpoint — park here and keep polling the URL.
    if (!challengeNotified && /linkedin\.com\/(checkpoint|uas)/.test(url)) {
      if (await anyVisible(page, CHALLENGE_HINTS, 2_500)) {
        warn(
          'LinkedIn is asking for a security check (PIN / device verification).',
        )
        warn(
          'Complete it in the open browser window — this run will wait and continue.',
        )
        challengeNotified = true
      }
    }

    // 5. Supabase surfaced a configuration error rather than redirecting.
    if (/supabase\.co/.test(url) && !url.includes('/auth/v1/authorize')) {
      const body = await page.content().catch(() => '')
      if (/redirect|not allowed|invalid/i.test(body)) {
        warn(`Supabase auth page reported a problem at ${url}`)
      }
    }

    await page.waitForTimeout(1_000)
  }

  throw new Error(
    `timed out after ${timeout}ms waiting to land back in the app (last URL: ${page.url()})`,
  )
}

// ── session persistence ───────────────────────────────────────────────────
/**
 * Persist cookies + localStorage so Playwright tests (and repeat runs) can
 * boot straight into the authenticated app. storageState() is the canonical
 * Playwright contract consumed via `use: { storageState: ... }`.
 */
async function saveState(context, out) {
  const target = resolve(ROOT, out)
  mkdirSync(dirname(target), { recursive: true })
  await context.storageState({ path: target })
  return target
}

/** True when the Supabase auth cookie is present (i.e. a real session landed). */
async function hasAuthCookie(context) {
  const cookies = await context.cookies()
  return cookies.some(
    (cookie) =>
      /^sb-.*-auth-token/.test(cookie.name) && cookie.value.length > 0,
  )
}

/** Best-effort artefact so a failed handshake is diagnosable after the fact. */
async function captureFailure(page, label) {
  if (!page || page.isClosed()) return null
  const dir = resolve(ROOT, SHOT_DIR)
  try {
    mkdirSync(dir, { recursive: true })
    const file = resolve(dir, `linkedin-login-${label}-${Date.now()}.png`)
    await page.screenshot({ path: file, fullPage: true })
    return file
  } catch {
    return null
  }
}

/** Resolve operator credentials without ever logging the secret. */
function resolveCredentials() {
  const email = process.env.LINKEDIN_TEST_EMAIL?.trim()
  const password = process.env.LINKEDIN_TEST_PASSWORD
  if (!email || !password) {
    fail(
      'missing LINKEDIN_TEST_EMAIL / LINKEDIN_TEST_PASSWORD — set them in .env.local (see .env.example)',
    )
    process.exit(2)
  }
  return { email, password }
}

// ── sign-in CTA (app/login/page.tsx) ──────────────────────────────────────
// Copy mirrors AUTH_MESSAGES.LINKEDIN_CTA (lib/messages.ts); the tag fallback
// keeps this working if the copy is reworded later.
const LOGIN_CTA_SELECTORS = [
  'button:has-text("Continue with LinkedIn")',
  'main button[type="button"]',
]

/** Fail fast with an actionable message when `next dev` is not running. */
async function assertServerReachable(origin) {
  try {
    const response = await fetch(`${origin}/login`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
    })
    if (response.status >= 500) {
      throw new Error(`server responded ${response.status}`)
    }
  } catch (error) {
    throw new Error(
      `cannot reach ${origin}/login (${
        error instanceof Error ? error.message : String(error)
      }). Start the app with \`npm run dev\` first.`,
    )
  }
}

async function main() {
  loadEnvFile(resolve(ROOT, '.env.local'))
  const opts = parseArgs(process.argv.slice(2))
  const origin = opts.url.replace(/\/+$/, '')
  const { email, password } = resolveCredentials()

  await runStep(`dev server reachable at ${origin}`, () =>
    assertServerReachable(origin),
  )

  // Persistent Chromium profile (gitignored). LinkedIn's one-time security
  // checkpoint (device PIN / email verification) mints a trusted-device cookie
  // inside this directory, so the checkpoint has to be solved once instead of
  // on every single run.
  const profileDir = resolve(ROOT, opts.profile)
  mkdirSync(profileDir, { recursive: true })

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: opts.headless,
    slowMo: opts.slowMo,
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  })
  await tagWindow(context, 'Connect · linkedin-login')

  // A persistent context opens with one blank tab already attached; reuse it so
  // we never end up with a stray about:blank window beside the flow.
  const page = context.pages()[0] ?? (await context.newPage())
  let failureLabel = 'unknown'

  try {
    await runStep(`open ${origin}/login`, () =>
      page.goto(`${origin}/login`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      }),
    )

    const cta = await runStep('click "Continue with LinkedIn"', () =>
      clickAny(page, LOGIN_CTA_SELECTORS, 'LinkedIn sign-in button'),
    )
    step(`matched CTA selector: ${cta}`)

    const finalUrl = await runStep('complete LinkedIn OAuth handshake', () =>
      completeHandshake(page, {
        origin,
        email,
        password,
        timeout: opts.timeout,
      }),
    )
    ok(`landed at ${finalUrl}`)

    if (!(await hasAuthCookie(context))) {
      failureLabel = 'no-session'
      throw new Error(
        'reached the app but no Supabase auth cookie was set — the session was not established',
      )
    }
    ok('Supabase auth cookie present')

    const statePath = await runStep('persist authenticated session', () =>
      saveState(context, opts.out),
    )
    ok(`session written to ${statePath}`)
    ok(`signed in as ${email}`)

    if (opts.keepOpen) {
      warn('browser left open (--keep-open); press Ctrl+C to exit')
      await new Promise(() => {})
    }
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
    const shot = await captureFailure(page, failureLabel)
    if (shot) warn(`screenshot saved to ${shot}`)
    await context.close().catch(() => {})
    process.exit(1)
  }

  await context.close().catch(() => {})
  process.exit(0)
}

main().catch((error) => {
  fail(error instanceof Error ? error.stack || error.message : String(error))
  process.exit(1)
})
