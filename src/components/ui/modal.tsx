'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  children: ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Modal({ open, onOpenChange, title, description, children, className, size = 'md' }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-xl shadow-2xl',
            'bg-white dark:bg-[#0f1d42] dark:border dark:border-[#1e3570]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
            'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
            'max-h-[90vh] overflow-y-auto',
            size === 'sm' && 'w-full max-w-sm',
            size === 'md' && 'w-full max-w-lg',
            size === 'lg' && 'w-full max-w-2xl',
            size === 'xl' && 'w-full max-w-4xl',
            className
          )}
        >
          <div className="flex items-start justify-between p-6 border-b border-[#E2E8F0] dark:border-[#1e3570]">
            <div>
              {title && (
                <Dialog.Title className="text-lg font-semibold text-[#1a2a5e] dark:text-[#e2e8f0]">
                  {title}
                </Dialog.Title>
              )}
              {description && (
                <Dialog.Description className="mt-1 text-sm text-[#64748B] dark:text-[#94a3b8]">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F1F5F9] dark:text-[#94a3b8] dark:hover:bg-white/10 transition-colors ml-4">
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="p-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
