'use client'

// Client half of the dashboard layout: resolves the active nav item from the
// current pathname and navigates via next/router. Kept separate from
// app/dashboard/layout.tsx (server) so the server wrapper stays cookie-aware
// without shipping session reads to the browser.
import type { ReactNode } from 'react'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'

import { AuthenticatedShell } from '@/components/layout/AuthenticatedShell'
import { DashboardShellIdentity } from '@/components/layout/DashboardShellIdentity'
import { NotificationBell } from '@/components/notifications'
import { mainNavItems, mobileNavItems } from '@/config/navigation'

function activeLabelForPath(pathname: string): string | undefined {
  const all = [...mainNavItems]
  const match = all
    .filter(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0]
  return match?.label
}

function BrandMark() {
  return (
    <Link
      href="/dashboard/discover"
      aria-label="Go to Discover"
      className="flex size-9 items-center justify-center rounded-xl bg-[var(--cx-brand)] text-white shadow-[0_8px_24px_rgba(208,164,91,.28)]"
    >
      <Sparkles className="size-4" />
    </Link>
  )
}

export function DashboardLayoutShell({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  const pathname = usePathname()
  const router = useRouter()
  const activeLabel = pathname ? activeLabelForPath(pathname) : undefined
  const navItems = [...mainNavItems]
  const mobileItems = [...mobileNavItems]

  function handleNavigate(label: string): void {
    const target = [...mainNavItems, ...mobileNavItems].find(
      (item) => item.label === label,
    )
    if (target) router.push(target.href)
  }

  return (
    <AuthenticatedShell
      navItems={navItems}
      mobileNavItems={mobileItems}
      activeLabel={activeLabel}
      onNavigate={handleNavigate}
      headerLeft={<BrandMark />}
      headerRight={
        <div className="flex items-center gap-1.5">
          <NotificationBell />
          <DashboardShellIdentity />
        </div>
      }
      showMobileNav
    >
      {children}
    </AuthenticatedShell>
  )
}
