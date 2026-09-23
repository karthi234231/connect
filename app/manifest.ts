// app/manifest.ts
// PWA manifest — served at /manifest.webmanifest and auto-linked by Next.js.
// Colours mirror the `--cx-*` design tokens (dark shell is the product default).
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Connect — Find your people. Build what matters.',
    short_name: 'Connect',
    description:
      'Connect matches you with collaborators by intent — co-founders, co-builders, and crew for your next idea or event.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    // --cx-bg / --cx-brand from app/globals.css
    background_color: '#0A0C0F',
    theme_color: '#0A0C0F',
    categories: ['social', 'business', 'productivity'],
    lang: 'en',
    dir: 'ltr',
    icons: [
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/logo.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      { name: 'Discover', url: '/dashboard' },
      { name: 'Events', url: '/dashboard/events' },
      { name: 'Messages', url: '/dashboard/chat' },
    ],
  }
}
