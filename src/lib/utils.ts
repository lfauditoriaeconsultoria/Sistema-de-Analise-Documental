import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { ComplianceLevel } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString))
}

export function formatDateShort(dateString: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateString))
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function complianceLabel(level: ComplianceLevel): string {
  const labels: Record<ComplianceLevel, string> = {
    conforme: 'Conforme',
    parcialmente_conforme: 'Parcialmente Conforme',
    nao_conforme: 'Não Conforme',
  }
  return labels[level]
}

export function complianceBadgeClass(level: ComplianceLevel): string {
  const classes: Record<ComplianceLevel, string> = {
    conforme: 'badge-conforme',
    parcialmente_conforme: 'badge-parcial',
    nao_conforme: 'badge-nao-conforme',
  }
  return classes[level]
}

export function complianceColor(level: ComplianceLevel): string {
  const colors: Record<ComplianceLevel, string> = {
    conforme: '#16A34A',
    parcialmente_conforme: '#D97706',
    nao_conforme: '#DC2626',
  }
  return colors[level]
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? ''
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + '...'
}
