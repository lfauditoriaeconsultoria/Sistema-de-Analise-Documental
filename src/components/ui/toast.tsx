'use client'

import * as ToastPrimitive from '@radix-ui/react-toast'
import { cn } from '@/lib/utils'
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'
import { createContext, useContext, useState, ReactNode } from 'react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: string
  type: ToastType
  title: string
  description?: string
}

interface ToastContextValue {
  toast: (item: Omit<ToastItem, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  function addToast(item: Omit<ToastItem, 'id'>) {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { ...item, id }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
  }

  const icons: Record<ToastType, ReactNode> = {
    success: <CheckCircle size={18} className="text-[#16A34A]" />,
    error: <XCircle size={18} className="text-[#DC2626]" />,
    warning: <AlertCircle size={18} className="text-[#D97706]" />,
    info: <AlertCircle size={18} className="text-[#1B3A8C]" />,
  }

  const borderColors: Record<ToastType, string> = {
    success: 'border-l-[#16A34A]',
    error: 'border-l-[#DC2626]',
    warning: 'border-l-[#D97706]',
    info: 'border-l-[#1B3A8C]',
  }

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {toasts.map(t => (
          <ToastPrimitive.Root
            key={t.id}
            open
            className={cn(
              'flex items-start gap-3 bg-white rounded-xl border border-l-4 p-4 shadow-lg',
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[swipe=end]:animate-out data-[state=closed]:fade-out-80',
              'data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full',
              borderColors[t.type]
            )}
          >
            <div className="mt-0.5">{icons[t.type]}</div>
            <div className="flex-1">
              <ToastPrimitive.Title className="text-sm font-semibold text-[#1a2a5e]">{t.title}</ToastPrimitive.Title>
              {t.description && (
                <ToastPrimitive.Description className="mt-0.5 text-xs text-[#64748B]">{t.description}</ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close className="text-[#94A3B8] hover:text-[#64748B]">
              <X size={14} />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[100vw]" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  )
}
