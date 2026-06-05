import { cn } from '@/lib/utils'
import { HTMLAttributes } from 'react'
import { ComplianceLevel } from '@/types'
import { complianceBadgeClass, complianceLabel } from '@/lib/utils'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'muted'
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variant === 'default' && 'bg-[#F1F5F9] text-[#475569] dark:bg-white/10 dark:text-[#94a3b8]',
        variant === 'primary' && 'bg-[#EEF2FF] text-[#1B3A8C] dark:bg-blue-900/40 dark:text-blue-300',
        variant === 'success' && 'bg-[#DCFCE7] text-[#15803D] dark:bg-green-900/30 dark:text-green-400',
        variant === 'warning' && 'bg-[#FEF3C7] text-[#92400E] dark:bg-amber-900/30 dark:text-amber-400',
        variant === 'danger' && 'bg-[#FEE2E2] text-[#991B1B] dark:bg-red-900/30 dark:text-red-400',
        variant === 'muted' && 'bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0] dark:bg-white/5 dark:text-[#94a3b8] dark:border-[#1e3570]',
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export function ComplianceBadge({ level }: { level: ComplianceLevel }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold', complianceBadgeClass(level))}>
      {complianceLabel(level)}
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; class: string }> = {
    pending:    { label: 'Aguardando',   class: 'bg-[#F1F5F9] text-[#475569] dark:bg-white/10 dark:text-[#94a3b8]' },
    processing: { label: 'Processando',  class: 'bg-[#DBEAFE] text-[#1D4ED8] dark:bg-blue-900/40 dark:text-blue-300' },
    completed:  { label: 'Concluída',    class: 'bg-[#DCFCE7] text-[#15803D] dark:bg-green-900/30 dark:text-green-400' },
    failed:     { label: 'Erro',         class: 'bg-[#FEE2E2] text-[#991B1B] dark:bg-red-900/30 dark:text-red-400' },
  }
  const v = variants[status] ?? variants.pending
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', v.class)}>
      {v.label}
    </span>
  )
}
