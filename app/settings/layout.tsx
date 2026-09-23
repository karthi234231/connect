// src/app/settings/layout.tsx
// Authenticated non-dashboard surfaces (/settings/*, /traction): the proxy
// gates auth, this layout adds the same navbar chrome as /dashboard so the
// nav is visible on every post-login route. Thin wrapper — auth stays in
// proxy.ts + per-action checks.
import type { ReactNode } from 'react'

import { DashboardLayoutShell } from '@/components/layout/DashboardLayoutShell'

export default function SettingsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <DashboardLayoutShell>{children}</DashboardLayoutShell>
}
