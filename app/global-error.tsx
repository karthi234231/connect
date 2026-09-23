'use client'

// app/global-error.tsx
// Last-resort boundary: fires only when the ROOT layout itself throws, so it
// must render its own <html>/<body> and cannot rely on providers, ThemeProvider,
// the Toaster, or globals.css. Everything below is intentionally self-contained
// and uses the same brand tokens (--cx-bg #0A0C0F, --cx-brand #D0A45B) so a
// hard failure still looks like Connect.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100svh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0A0C0F',
          color: '#F1EEE7',
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
          padding: '24px',
        }}
      >
        <main
          style={{
            width: '100%',
            maxWidth: '420px',
            textAlign: 'center',
            border: '1px solid #293038',
            borderRadius: '20px',
            backgroundColor: '#101317',
            padding: '40px 24px',
          }}
        >
          <div
            style={{
              margin: '0 auto 16px',
              width: '56px',
              height: '56px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '16px',
              backgroundColor: '#38211E',
              color: '#E47D72',
              fontSize: '26px',
              lineHeight: 1,
            }}
            aria-hidden="true"
          >
            !
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 600,
              letterSpacing: '-0.02em',
            }}
          >
            Connect hit an unexpected error
          </h1>
          <p
            style={{
              margin: '6px 0 0',
              fontSize: '14px',
              lineHeight: '20px',
              color: '#8D8A84',
            }}
          >
            The page could not be rendered. Your data is safe — reload to try
            again, and contact support if it keeps happening.
          </p>
          {error.digest ? (
            <p
              style={{
                margin: '12px 0 0',
                fontSize: '12px',
                color: '#666762',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '20px',
              cursor: 'pointer',
              borderRadius: '9999px',
              border: '1px solid transparent',
              backgroundColor: '#D0A45B',
              color: '#0A0C0F',
              fontSize: '14px',
              fontWeight: 600,
              padding: '10px 18px',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
