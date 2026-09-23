import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { DashboardShellIdentity } from '@/components/layout/DashboardShellIdentity'

/**
 * @deprecated Rendered only by app/dashboard/layout.tsx now (single header).
 * Page-level usage is removed so the shell never renders two sticky headers.
 * Kept as a named fragment for the layout until the last page import lands.
 */
export function DashboardShellBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--cx-border-1)] bg-[color:var(--cx-bg)/.94] backdrop-blur-xl">
      <div className="mx-auto flex h-[50px] max-w-[1180px] items-center justify-between px-2.5 sm:h-[68px] sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          aria-label="Go to dashboard"
          className="flex size-9 items-center justify-center rounded-xl bg-[var(--cx-brand)] text-white shadow-[0_8px_24px_rgba(208,164,91,.28)]"
        >
          <Sparkles className="size-4" />
        </Link>
        <div className="flex items-center gap-3">
          <DashboardShellIdentity />
        </div>
      </div>
    </header>
  )
}
