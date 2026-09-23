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
      {
        name: 'Discover Collaborators',
        short_name: 'Discover',
        description: 'Find co-founders, co-builders, and crew by intent.',
        url: '/dashboard/discover',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
      {
        name: 'Explore Events & Meetups',
        short_name: 'Events',
        description:
          'Browse upcoming builder meetups, hackathons, and virtual events.',
        url: '/events',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
      {
        name: 'Share an Idea',
        short_name: 'New Idea',
        description:
          'Post your new idea or project to find early team members.',
        url: '/dashboard/ideas/new',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
      {
        name: 'Direct Messages',
        short_name: 'Messages',
        description: 'Chat with matched collaborators and event attendees.',
        url: '/dashboard/chat',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
      {
        name: 'Search Events',
        short_name: 'Search',
        description: 'Filter community events by category, format, and city.',
        url: '/events/search',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
      {
        name: 'My Connections',
        short_name: 'Connections',
        description: 'View active connections and team relationship momentum.',
        url: '/dashboard/connections',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
    ],
  }
}

