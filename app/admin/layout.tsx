// app/admin/layout.tsx
// Admin segment gate (P0-33). This is the ONE place the whole /admin subtree is
// protected server-side: an authenticated, non-suspended account whose profile
// carries app_role='admin'. requireAdmin() itself enforces the active-account
// lifecycle first (P0-15), so a suspended admin is denied here too.
//
// This gate is a convenience/defense-in-depth boundary — every admin MUTATION
// still authorizes independently in its server action (`requireAdmin`), because
// a layout never runs for a direct action call.
import type { ReactNode } from 'react'

import { requireAdmin } from '@/lib/auth'
import { AdminHeader } from '@/app/admin/_components/AdminHeader'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  // Throws AppError (unauthenticated / suspended / forbidden) for non-admins.
  // The thrown error surfaces through app/error.tsx rather than rendering the
  // console, so no admin chrome leaks to an unauthorized caller.
  await requireAdmin()

  return (
    <main className="cx-page-enter min-h-screen w-full max-w-full overflow-x-hidden bg-[var(--cx-bg)] text-[var(--cx-text-1)]">
      <AdminHeader />
      <div className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6 lg:px-8">
        {children}
      </div>
    </main>
  )
}
