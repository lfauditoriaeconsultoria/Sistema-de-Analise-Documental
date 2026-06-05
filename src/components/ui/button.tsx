'use client'

import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 select-none',
  {
    variants: {
      variant: {
        primary:
          'bg-[#1B3A8C] text-white hover:bg-[#0f2260] focus-visible:ring-[#1B3A8C] shadow-sm hover:shadow-md dark:bg-[#2D6BE4] dark:hover:bg-[#1B3A8C]',
        secondary:
          'bg-white text-[#1B3A8C] border border-[#1B3A8C] hover:bg-[#EEF2FF] focus-visible:ring-[#1B3A8C] dark:bg-[#1e3570] dark:text-blue-200 dark:border-blue-400/50 dark:hover:bg-[#253d7a]',
        success:
          'bg-[#16A34A] text-white hover:bg-[#15803D] focus-visible:ring-[#16A34A] shadow-sm',
        danger:
          'bg-[#DC2626] text-white hover:bg-[#B91C1C] focus-visible:ring-[#DC2626] shadow-sm',
        ghost:
          'text-[#1B3A8C] hover:bg-[#EEF2FF] focus-visible:ring-[#1B3A8C] dark:text-blue-300 dark:hover:bg-white/10',
        muted:
          'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0] focus-visible:ring-[#64748B] dark:bg-white/10 dark:text-[#94a3b8] dark:hover:bg-white/15',
      },
      size: {
        sm: 'text-xs px-3 py-1.5 h-8',
        md: 'text-sm px-4 py-2 h-10',
        lg: 'text-base px-6 py-2.5 h-12',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
