import type { LucideIcon } from 'lucide-react'
import {
  Compass,
  MessageCircle,
  Settings,
  Sparkles,
  Ticket,
  UserRound,
  UsersRound,
} from 'lucide-react'

import { ROUTES } from '@/config/routes'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

// Destinations only — never an unread/active badge here. Counts are live data
// and must come from a fetch (see DashboardShellIdentity / dashboard hub), so a
// hard-coded number would be a fabricated signal. Consumers that need a badge
// read it from the query layer, not this static registry.
export const mainNavItems: NavItem[] = [
  { label: 'Discover', href: ROUTES.discover, icon: Compass },
  { label: 'Events', href: ROUTES.events, icon: Ticket },
  { label: 'Connect', href: ROUTES.connections, icon: UsersRound },
  { label: 'Messages', href: ROUTES.chat, icon: MessageCircle },
]

export const secondaryNavItems: NavItem[] = [
  { label: 'Profile', href: ROUTES.profile, icon: UserRound },
  { label: 'Settings', href: ROUTES.settings, icon: Settings },
  { label: 'Onboarding', href: ROUTES.onboarding, icon: Sparkles },
]

export const mobileNavItems: NavItem[] = mainNavItems

