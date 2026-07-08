import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getUserInitials(user: { pseudonym?: string | null; firstName?: string | null; lastName?: string | null }): string {
  if (user.pseudonym) return user.pseudonym.slice(0, 2).toUpperCase()
  return `${(user.firstName ?? '?').charAt(0)}${(user.lastName ?? '?').charAt(0)}`.toUpperCase()
}
