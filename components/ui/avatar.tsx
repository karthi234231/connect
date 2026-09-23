import type { HTMLAttributes, ImgHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  avatarClassName?: string
  children?: ReactNode
}

export function Avatar({
  avatarClassName,
  className,
  children,
  ...props
}: AvatarProps) {
  return (
    <div
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-full',
        avatarClassName,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export interface AvatarImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
}

export function AvatarImage({
  className,
  src,
  alt,
  ...props
}: AvatarImageProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={cn('size-full rounded-full object-cover', className)}
      {...props}
    />
  )
}

export interface AvatarFallbackProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode
}

export function AvatarFallback({
  className,
  children,
  ...props
}: AvatarFallbackProps) {
  return (
    <div
      className={cn(
        'flex size-full items-center justify-center rounded-full text-xs font-semibold',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
