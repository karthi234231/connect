'use client'

// app/global-error.tsx
// Last-resort boundary: fires only when the ROOT layout itself throws, so it
// must render its own <html>/<body> and cannot rely on providers or external css.
// Self-contained luxury glass 500 page with brand design tokens (--cx-bg #0A0C0F, --cx-brand #D0A45B).

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <head>
        <title>500 — System Exception | Connect</title>
      </head>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0A0C0F',
          color: '#F1EEE7',
          fontFamily:
            'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: '24px',
          boxSizing: 'border-box',
          overflowX: 'hidden',
        }}
      >
        {/* Background Ambient Glow */}
        <div
          style={{
            position: 'fixed',
            top: '-200px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle at center, rgba(208, 164, 91, 0.14) 0%, transparent 70%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
          aria-hidden="true"
        />

        {/* Luxury Glass Boundary Card */}
        <main
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            maxWidth: '480px',
            textAlign: 'center',
            border: '1px solid rgba(41, 48, 56, 0.9)',
            borderRadius: '24px',
            backgroundColor: 'rgba(16, 19, 23, 0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            padding: '44px 28px',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7)',
            boxSizing: 'border-box',
          }}
        >
          {/* Subtle Card Top Highlight */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '24px',
              border: '1px solid rgba(208, 164, 91, 0.25)',
              pointerEvents: 'none',
              maskImage:
                'linear-gradient(to bottom, rgba(255,255,255,1), transparent)',
              WebkitMaskImage:
                'linear-gradient(to bottom, rgba(255,255,255,1), transparent)',
            }}
            aria-hidden="true"
          />

          {/* Warning Icon Badge */}
          <div
            style={{
              margin: '0 auto 20px',
              width: '64px',
              height: '64px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '20px',
              border: '1px solid rgba(228, 125, 114, 0.3)',
              backgroundColor: '#2A1817',
              color: '#E47D72',
              fontSize: '28px',
              fontWeight: 'bold',
              boxShadow: '0 0 24px rgba(228, 125, 114, 0.2)',
            }}
            aria-hidden="true"
          >
            !
          </div>

          {/* 500 Pill Tag */}
          <div
            style={{
              display: 'inline-block',
              borderRadius: '9999px',
              border: '1px solid rgba(228, 125, 114, 0.3)',
              backgroundColor: 'rgba(228, 125, 114, 0.1)',
              padding: '4px 14px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#E47D72',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: '16px',
            }}
          >
            500 · System Exception
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: '22px',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: '#F1EEE7',
            }}
          >
            Connect hit an unexpected error
          </h1>

          <p
            style={{
              margin: '10px 0 0',
              fontSize: '14px',
              lineHeight: '22px',
              color: '#8D8A84',
            }}
          >
            The page could not be rendered due to a root execution failure.
            Your data remains secure — try recovering using the buttons below.
          </p>

          {error.digest ? (
            <div
              style={{
                marginTop: '16px',
                display: 'inline-block',
                borderRadius: '8px',
                border: '1px solid rgba(41, 48, 56, 0.6)',
                backgroundColor: '#16191E',
                padding: '6px 12px',
                fontSize: '11px',
                color: '#666762',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}
            >
              Ref ID: {error.digest}
            </div>
          ) : null}

          {/* Recovery Actions */}
          <div
            style={{
              marginTop: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                width: '100%',
                cursor: 'pointer',
                borderRadius: '12px',
                border: 'none',
                background:
                  'linear-gradient(135deg, #D0A45B 0%, #E6C687 100%)',
                color: '#0A0C0F',
                fontSize: '14px',
                fontWeight: 600,
                padding: '12px 20px',
                boxShadow: '0 4px 16px rgba(208, 164, 91, 0.25)',
                transition: 'transform 0.15s ease, filter 0.15s ease',
              }}
            >
              Try again
            </button>

            <div
              style={{
                display: 'flex',
                gap: '12px',
              }}
            >
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  flex: 1,
                  cursor: 'pointer',
                  borderRadius: '12px',
                  border: '1px solid #293038',
                  backgroundColor: 'rgba(22, 27, 34, 0.8)',
                  color: '#F1EEE7',
                  fontSize: '13px',
                  fontWeight: 500,
                  padding: '10px 16px',
                }}
              >
                Reload page
              </button>

              <button
                type="button"
                onClick={() => (window.location.href = '/')}
                style={{
                  flex: 1,
                  cursor: 'pointer',
                  borderRadius: '12px',
                  border: '1px solid #293038',
                  backgroundColor: 'rgba(22, 27, 34, 0.8)',
                  color: '#F1EEE7',
                  fontSize: '13px',
                  fontWeight: 500,
                  padding: '10px 16px',
                }}
              >
                Return home
              </button>
            </div>
          </div>
        </main>
      </body>
    </html>
  )
}
