'use client'

import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'
import { Container } from './Container'
import { Header } from './Header'
import { MobileNav } from './MobileNav'
import type { NavItem } from './DesktopNav'

type AppShellProps = {
  headerLeft?: ReactNode
  headerCenter?: ReactNode
  headerRight?: ReactNode
  sidebar?: ReactNode
  navItems?: NavItem[]
  mobileNavItems?: NavItem[]
  activeLabel?: string
  onNavigate?: (label: string) => void
  children: ReactNode
  showMobileNav?: boolean
  className?: string
}

export function AppShell({
  headerLeft,
  headerCenter,
  headerRight,
  sidebar,
  navItems,
  mobileNavItems,
  activeLabel,
  onNavigate,
  children,
  showMobileNav = true,
  className,
}: AppShellProps) {
  const mobileItems = mobileNavItems ?? navItems
  return (
    <div className="flex min-h-screen w-full flex-col bg-[var(--cx-bg)] text-[var(--cx-text-1)]">
      <Header left={headerLeft} center={headerCenter} right={headerRight} />
      <Container className="flex min-h-[calc(100svh-50px)] flex-1 flex-col sm:min-h-[calc(100svh-68px)]">
        <div className="flex flex-1">
          {sidebar ? (
            <aside className="hidden w-[220px] shrink-0 border-r border-[var(--cx-border-1)] px-4 py-8 lg:block">
              {sidebar}
            </aside>
          ) : null}
          <main
            className={cn(
              'min-w-0 max-w-full flex-1 overflow-x-hidden',
              className,
            )}
          >
            {children}
          </main>
        </div>
      </Container>
      {showMobileNav && mobileItems && mobileItems.length > 0 ? (
        <MobileNav
          items={mobileItems}
          activeLabel={activeLabel}
          onNavigate={onNavigate}
        />
      ) : null}
    </div>
  )
}
