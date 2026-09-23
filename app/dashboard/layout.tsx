// src/app/dashboard/layout.tsx
// Authenticated layout (STR-02): every /dashboard/* child renders inside one
// <AuthenticatedShell> so the navbar/header is always present after login.
// Auth truth stays where it already lives: proxy.ts gates the segment and
// server actions re-verify per call — the layout only wires navigation.
import type { ReactNode } from 'react'

import { DashboardLayoutShell } from '@/components/layout/DashboardLayoutShell'

export default function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <DashboardLayoutShell>{children}</DashboardLayoutShell>
}
