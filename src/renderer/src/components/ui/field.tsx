import { cn } from '@/lib/utils'
import type { HTMLAttributes, ReactNode } from 'react'

export function Field({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)} {...props}>
      {children}
    </div>
  )
}

export function FieldLabel({
  className,
  children
}: {
  className?: string
  children: ReactNode
}) {
  return <label className={cn('text-sm font-medium', className)}>{children}</label>
}
