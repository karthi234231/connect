import type { Metadata } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'

import '@/app/globals.css'

import { ThemeProvider } from '@teispace/next-themes'

import { Toaster } from '@/components/ui/sonner'
import { VisualRouteFrame } from '@/components/layout/VisualRouteFrame'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

/**
 * Canonical public origin for absolute metadata URLs (OG images, canonicals).
 * Never throws: a malformed NEXT_PUBLIC_APP_URL degrades to Next's default
 * instead of breaking the build.
 */
function resolveMetadataBase(): URL | undefined {
  const raw = process.env.NEXT_PUBLIC_APP_URL
  if (typeof raw !== 'string' || raw.length === 0) {
    return undefined
  }
  try {
    return new URL(raw)
  } catch {
    return undefined
  }
}

export const metadata: Metadata = {
  // Without an explicit base, Next falls back to the request host and warns on
  // every build. Prefer the canonical public origin.
  metadataBase: resolveMetadataBase(),
  title: {
    default: 'Connect — Find your people. Build what matters.',
    template: '%s — Connect',
  },
  description:
    'Connect matches you with collaborators by intent — co-founders, co-builders, and crew for your next idea or event.',
  applicationName: 'Connect',
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    type: 'website',
    siteName: 'Connect',
    title: 'Connect — Find your people. Build what matters.',
    description:
      'Connect matches you with collaborators by intent — co-founders, co-builders, and crew for your next idea or event.',
    images: ['/logo.svg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Connect — Find your people. Build what matters.',
    description:
      'Connect matches you with collaborators by intent — co-founders, co-builders, and crew for your next idea or event.',
    images: ['/logo.svg'],
  },
  appleWebApp: {
    capable: true,
    title: 'Connect',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        // Browser extensions (Grammarly et al.) inject attributes onto <body>
        // before React hydrates. suppressHydrationWarning is scoped to this
        // element's own attributes, so this silences extension noise without
        // masking real mismatches inside the tree.
        suppressHydrationWarning
        className={`${inter.variable} ${spaceGrotesk.variable} min-h-svh w-screen max-w-[100vw] overflow-x-clip bg-[var(--cx-bg)] font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          storageKey="cx-theme"
          disableTransitionOnChange
        >
          <VisualRouteFrame>{children}</VisualRouteFrame>

          <Toaster position="bottom-right" closeButton />
        </ThemeProvider>
      </body>
    </html>
  )
}
