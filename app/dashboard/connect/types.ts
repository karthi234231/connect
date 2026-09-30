// src/app/dashboard/connect/types.ts
// Local view types for the Connect hub. Kept out of the page module so both the
// server page and the client hub can import them without pulling either side's
// runtime deps across the boundary.
import type { DiscoverBatch } from '@/services/discover/candidates.service'

/** A Discover batch, or the non-pageable "invalid cursor" fallback shape. */
export type DeckBatch =
  | DiscoverBatch
  | { items: []; nextCursorToken: null; version: 'invalid' }

/** The five Connect surfaces, in nav order. */
export type ConnectTab =
  | 'discover'
  | 'ideas'
  | 'matches'
  | 'requests'
  | 'sent'

export const CONNECT_TABS: readonly ConnectTab[] = [
  'discover',
  'ideas',
  'matches',
  'requests',
  'sent',
] as const

export function isConnectTab(value: string | null): value is ConnectTab {
  return value != null && (CONNECT_TABS as readonly string[]).includes(value)
}

/** Title-case a tab id for the nav button label. */
export function connectTabLabel(tab: ConnectTab): string {
  return tab.charAt(0).toUpperCase() + tab.slice(1)
}
