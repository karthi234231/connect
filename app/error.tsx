'use client'

import { ErrorState } from '@/components/states/ErrorState'

export default function Error({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--cx-bg)] px-4">
      <ErrorState
        title="Something went wrong"
        description="Something went wrong while rendering this page."
        onRetry={reset}
      />
    </div>
  )
}
