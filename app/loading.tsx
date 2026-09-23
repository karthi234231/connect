// app/loading.tsx
// Root Suspense fallback: any route that suspends on dynamic data shows the
// themed loader instead of a blank frame. Uses the shared LoadingState so the
// treatment stays identical to in-page loading.
import { LoadingState } from '@/components/states/LoadingState'

export default function Loading() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-[var(--cx-bg)] px-4">
      <LoadingState label="Loading…" />
    </div>
  )
}
