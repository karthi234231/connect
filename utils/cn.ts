import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge conditional class names with tailwind-merge, like shadcn's `cn`. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
