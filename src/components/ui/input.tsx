import { cn } from '@/lib/utils'
import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[#1a2a5e] dark:text-blue-100">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            'w-full h-10 px-3 rounded-lg border text-sm transition-colors',
            'border-[#E2E8F0] bg-white text-[#1a2a5e] placeholder:text-[#94A3B8]',
            'dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30',
            'focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] focus:border-transparent dark:focus:ring-blue-400',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-[#DC2626] focus:ring-[#DC2626]',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-[#DC2626] dark:text-red-400">{error}</p>}
        {hint && !error && <p className="text-xs text-[#64748B] dark:text-blue-300/60">{hint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[#1a2a5e] dark:text-blue-100">
            {label}
          </label>
        )}
        <textarea
          id={inputId}
          ref={ref}
          className={cn(
            'w-full px-3 py-2 rounded-lg border text-sm transition-colors resize-none',
            'border-[#E2E8F0] bg-white text-[#1a2a5e] placeholder:text-[#94A3B8]',
            'dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30',
            'focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] focus:border-transparent dark:focus:ring-blue-400',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-[#DC2626] focus:ring-[#DC2626]',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-[#DC2626] dark:text-red-400">{error}</p>}
        {hint && !error && <p className="text-xs text-[#64748B] dark:text-blue-300/60">{hint}</p>}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'
