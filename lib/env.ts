// src/lib/env.ts
// Lazy env: validates on property access, not at module import.
// This lets `next build` collect page data (module evaluation) without
// throwing when env is absent, while runtime access still fails fast.
import { z } from 'zod'

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Required'),
  NEXT_PUBLIC_APP_URL: z.string().url('Must be a valid URL'),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
})

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Required'),
  SUPABASE_DB_URL_POOLED: z.string().url().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url('Must be a valid URL'),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1, 'Required'),
  ABLY_API_KEY: z.string().min(1, 'Required'),
  RESEND_API_KEY: z.string().min(1, 'Required'),
  EMAIL_FROM: z.string().email().optional(),
  CSRF_SECRET: z.string().min(32, 'Must be at least 32 characters'),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  WORKER_SECRET: z
    .string()
    .min(16, 'Must be at least 16 characters')
    .optional(),
  // ── Optional integrations (§339). All optional: Connect must run with the
  // core stack alone, and each integration fails closed when unconfigured.
  POSTHOG_API_KEY: z.string().optional(),
  POSTHOG_HOST: z.string().url().optional(),
  /** HMAC secret for actor pseudonymisation. <16 chars disables the mirror. */
  POSTHOG_PSEUDONYM_SECRET: z.string().optional(),
  MEILISEARCH_HOST: z.string().url().optional(),
  MEILISEARCH_API_KEY: z.string().optional(),
  /** Index/alias namespace so staging and prod never share an index. */
  MEILISEARCH_INDEX_PREFIX: z.string().optional(),
  /**
   * Space-separated LinkedIn OIDC scopes the app requests on sign-in
   * (e.g. 'openid profile email r_basicprofile'). Optional — when unset (or
   * when any token is not a known LinkedIn scope) the app requests the
   * identity-only default, see parseLinkedInOAuthScopes in
   * services/linkedin/capabilities.ts.
   */
  LINKEDIN_OAUTH_SCOPES: z.string().optional(),
})

const SECRET_KEYS = new Set([
  'SUPABASE_SERVICE_ROLE_KEY',
  'UPSTASH_REDIS_REST_TOKEN',
  'ABLY_API_KEY',
  'RESEND_API_KEY',
  'CSRF_SECRET',
  'WORKER_SECRET',
  'SENTRY_AUTH_TOKEN',
  'TURNSTILE_SECRET_KEY',
  'POSTHOG_API_KEY',
  'POSTHOG_PSEUDONYM_SECRET',
  'MEILISEARCH_API_KEY',
])

function formatZodErrors(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join('.')
      const isSecret = SECRET_KEYS.has(path)
      const received =
        typeof issue.input === 'undefined'
          ? 'undefined'
          : isSecret
            ? `<${typeof issue.input}, len=${String(issue.input).length}>`
            : JSON.stringify(issue.input)
      return `  ❌ ${path}: ${issue.message} (received: ${received})`
    })
    .join('\n')
}

type Env = z.infer<typeof publicSchema> & Partial<z.infer<typeof serverSchema>>
export const isProduction = process.env.NODE_ENV === 'production'

let cached: Env | null = null
let warned = false

function loadEnv(): Env {
  if (cached) return cached
  if (typeof window !== 'undefined') {
    // Client‑side: only check public vars, but do NOT throw on missing – just warn.
    const parsed = publicSchema.safeParse(process.env)
    if (!parsed.success && !warned) {
      warned = true
      console.warn(
        '⚠️ Some public environment variables are missing or invalid:',
      )
      console.warn(formatZodErrors(parsed.error))
      console.warn(
        'The app may not work correctly. Please check your .env.local file.',
      )
    }
    cached = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL!,
    }
    return cached
  }
  // Server‑side: validate lazily. During `next build` page-data collection,
  // modules are evaluated without real env — defer the throw until a value
  // is actually read at request time.
  const combinedSchema = publicSchema.merge(serverSchema)
  const parsed = combinedSchema.safeParse(process.env)
  if (!parsed.success) {
    const message = `Missing or invalid environment variables. Check .env.local.\n${formatZodErrors(parsed.error)}`
    // Throw a deferred error: accessing any key throws with full detail.
    const throwing = new Proxy({} as Env, {
      get(_t, prop) {
        if (prop === 'then') return undefined // don't break await
        console.error('❌ Invalid environment variables:')
        console.error(formatZodErrors(parsed.error))
        throw new Error(message)
      },
    })
    cached = throwing
    return cached
  }
  cached = parsed.data
  return cached
}

/**
 * Eager environment validation for process bootstrap (`instrumentation.ts`)
 * and the readiness probe (`/api/health/ready`).
 *
 * Unlike `env` — which validates lazily on first property access so
 * `next build` can collect page data without secrets — this returns a plain
 * result object and never throws, so it is safe to call from anywhere.
 * Error strings are already redacted by `formatZodErrors` (secrets are reduced
 * to `<string, len=NN>`).
 */
export function validateEnvAtStartup(): { ok: boolean; errors: string[] } {
  const parsed = publicSchema.merge(serverSchema).safeParse(process.env)

  if (parsed.success) {
    return { ok: true, errors: [] }
  }

  return {
    ok: false,
    errors: parsed.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    ),
  }
}

// `env` keeps the same import shape (`import { env } from "@/lib/env"`)
// but validates on first property access instead of at module load.
export const env: Env = new Proxy({} as Env, {
  get(_t, prop) {
    return (loadEnv() as unknown as Record<PropertyKey, unknown>)[prop] as never
  },
})
