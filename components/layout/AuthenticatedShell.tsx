'use client'

import type { ReactNode } from 'react'
import { AppShell } from './AppShell'
import { DesktopNav } from './DesktopNav'
import type { NavItem } from './DesktopNav'

type AuthenticatedShellProps = {
  navItems: NavItem[]
  mobileNavItems?: NavItem[]
  activeLabel?: string
  onNavigate?: (label: string) => void
  headerLeft?: ReactNode
  headerCenter?: ReactNode
  headerRight?: ReactNode
  children: ReactNode
  showMobileNav?: boolean
  className?: string
}

export function AuthenticatedShell({
  navItems,
  mobileNavItems,
  activeLabel,
  onNavigate,
  headerLeft,
  headerCenter,
  headerRight,
  children,
  showMobileNav = true,
}: AuthenticatedShellProps) {
  return (
    <AppShell
      headerLeft={headerLeft}
      headerCenter={headerCenter}
      headerRight={headerRight}
      navItems={navItems}
      mobileNavItems={mobileNavItems}
      activeLabel={activeLabel}
      onNavigate={onNavigate}
      showMobileNav={showMobileNav}
      sidebar={
        <DesktopNav
          items={navItems}
          activeLabel={activeLabel}
          onNavigate={onNavigate}
        />
      }
    >
      {children}
    </AppShell>
  )
}
