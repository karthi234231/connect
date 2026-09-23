import Link from 'next/link'
import { Button } from '@/components/ui'
import { NotFoundState } from '@/components/states/NotFoundState'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--cx-bg)] px-4">
      <NotFoundState
        title="Page not found"
        description="The page you're looking for doesn't exist or has moved."
        action={
          <Link href="/">
            <Button>Back to Connect</Button>
          </Link>
        }
      />
    </div>
  )
}
