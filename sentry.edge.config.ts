// sentry.edge.config.ts
// Edge-runtime error reporting (proxy/middleware + edge route handlers).
// Loaded by `instrumentation.ts` only when NEXT_PUBLIC_SENTRY_DSN is set.
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies
        delete event.request.headers
      }
      return event
    },
  })
}
