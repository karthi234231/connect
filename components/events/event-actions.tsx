'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/button'

export interface EventActionsProps {
  /** 'guest' shows the sign-in deep link; 'authed' shows RSVP controls. */
  authState: 'guest' | 'authed'
  registered?: boolean
  waitlisted?: boolean
  hasEnded?: boolean
  registrationOpen?: boolean
  isFull?: boolean
  isRegistering?: boolean
  loginHref?: string
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  className?: string
  onRegister?: () => void
}

export function EventActions({
  authState,
  registered = false,
  waitlisted = false,
  hasEnded = false,
  registrationOpen = true,
  isFull = false,
  isRegistering = false,
  loginHref = '/login',
  size = 'md',
  fullWidth = false,
  className,
  onRegister,
}: EventActionsProps) {
  const actionClassName = cn(fullWidth && 'w-full', className)

  if (authState === 'guest') {
    return (
      <Link href={loginHref} className={cn(fullWidth && 'block')}>
        <Button size={size} className={actionClassName}>
          Sign in to register
        </Button>
      </Link>
    )
  }

  if (registered) {
    return (
      <Button
        size={size}
        variant="secondary"
        disabled
        className={actionClassName}
      >
        <Check className="size-4" /> You're registered
      </Button>
    )
  }

  if (waitlisted) {
    return (
      <Button
        size={size}
        variant="secondary"
        disabled
        className={actionClassName}
      >
        You're on the waitlist
      </Button>
    )
  }

  if (hasEnded) {
    return (
      <Button
        size={size}
        variant="secondary"
        disabled
        className={actionClassName}
      >
        Event ended
      </Button>
    )
  }

  if (registrationOpen === false) {
    return (
      <Button
        size={size}
        variant="secondary"
        disabled
        className={actionClassName}
      >
        Registration closed
      </Button>
    )
  }

  return (
    <Button
      size={size}
      disabled={isRegistering}
      onClick={onRegister}
      className={actionClassName}
    >
      {isRegistering ? 'Saving…' : isFull ? 'Join waitlist' : 'Register'}
    </Button>
  )
}
