import { cn } from '@/lib/utils'

interface ProgressProps {
  value: number
  max?: number
  className?: string
  showLabel?: boolean
  color?: string
  size?: 'sm' | 'md' | 'lg'
}

export function Progress({ value, max = 100, className, showLabel, color, size = 'md' }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const barColor = color ?? (pct >= 70 ? '#16A34A' : pct >= 40 ? '#D97706' : '#DC2626')

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className={cn(
          'flex-1 bg-[#F1F5F9] rounded-full overflow-hidden',
          size === 'sm' && 'h-1.5',
          size === 'md' && 'h-2.5',
          size === 'lg' && 'h-4'
        )}
      >
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      {showLabel && (
        <span className="text-sm font-semibold min-w-[3rem] text-right" style={{ color: barColor }}>
          {Math.round(pct)}%
        </span>
      )}
    </div>
  )
}
