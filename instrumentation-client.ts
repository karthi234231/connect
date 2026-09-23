// instrumentation-client.ts
// Browser bootstrap hook (Next.js ≥15.3). Because NEXT_PUBLIC_* values are
// inlined at build time, a project without NEXT_PUBLIC_SENTRY_DSN dead-code
// eliminates this entire block — zero client bytes, zero runtime cost.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  void import('@sentry/nextjs').then((Sentry) => {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    })
  })
}
