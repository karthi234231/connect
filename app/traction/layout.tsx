// src/app/traction/layout.tsx
// Same rationale as app/settings/layout.tsx: /traction is authenticated
// (proxy matcher) and must show the navbar chrome.
import type { ReactNode } from 'react'

import { DashboardLayoutShell } from '@/components/layout/DashboardLayoutShell'

export default function TractionLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <DashboardLayoutShell>{children}</DashboardLayoutShell>
}
