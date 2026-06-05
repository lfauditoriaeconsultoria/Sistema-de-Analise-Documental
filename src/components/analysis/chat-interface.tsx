'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Send, X, Bot, User, Loader2 } from 'lucide-react'

function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
        if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>
        return part
      })}
    </>
  )
}

function MarkdownMessage({ content }: { content: string }) {
  const lines = content.split('\n')
  const nodes: React.ReactNode[] = []
  const pending: React.ReactNode[] = []

  function flushList() {
    if (pending.length === 0) return
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="ml-3 my-1 space-y-0.5 list-disc list-inside">
        {pending.splice(0)}
      </ul>
    )
  }

  lines.forEach((line, i) => {
    if (/^#{1,3} /.test(line)) {
      flushList()
      nodes.push(<p key={i} className="font-semibold mt-2 mb-0.5">{inlineFormat(line.replace(/^#{1,3} /, ''))}</p>)
    } else if (/^[-*] /.test(line)) {
      pending.push(<li key={i}>{inlineFormat(line.slice(2))}</li>)
    } else if (/^---+$/.test(line.trim())) {
      flushList()
      nodes.push(<hr key={i} className="my-2 border-current opacity-20" />)
    } else if (line.trim() === '') {
      flushList()
      if (nodes.length > 0) nodes.push(<div key={i} className="h-1" />)
    } else {
      flushList()
      nodes.push(<p key={i} className="leading-relaxed">{inlineFormat(line)}</p>)
    }
  })
  flushList()

  return <div className="space-y-0.5">{nodes}</div>
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  analysisId: string
  analysisContext: string
  documentContent: string
  themeId: string
  subtopicId: string | null
  onClose: () => void
}

export function ChatInterface({ analysisId, analysisContext, documentContent, themeId, subtopicId, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Olá! Sou o assistente de análise da LF Auditoria. Tenho acesso ao documento enviado e ao relatório gerado — posso responder perguntas sobre o conteúdo do documento, explicar os apontamentos da análise ou tirar dúvidas de conformidade. Como posso ajudar?`,
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          analysisId,
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          analysisContext,
          documentContent,
          themeId,
          subtopicId,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: json.response }])
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.',
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed bottom-4 right-4 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-[#0f1d42] rounded-2xl shadow-2xl border border-[#E2E8F0] dark:border-[#1e3570] z-50 flex flex-col transition-colors"
      style={{ height: '480px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0] dark:border-[#1e3570] lf-gradient rounded-t-2xl">
        <div className="flex items-center gap-2 text-white">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
            <Bot size={14} />
          </div>
          <div>
            <p className="text-sm font-semibold">Assistente IA</p>
            <p className="text-xs text-blue-200">LF Consultoria</p>
          </div>
        </div>
        <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={cn('flex gap-2', msg.role === 'user' && 'flex-row-reverse')}>
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
              msg.role === 'user' ? 'bg-[#1B3A8C]' : 'bg-[#F0F4FF] dark:bg-[#1e3570]'
            )}>
              {msg.role === 'user'
                ? <User size={14} className="text-white" />
                : <Bot size={14} className="text-[#1B3A8C] dark:text-blue-300" />
              }
            </div>
            <div className={cn(
              'max-w-[80%] rounded-xl px-3 py-2 text-sm',
              msg.role === 'user'
                ? 'bg-[#1B3A8C] text-white rounded-tr-sm'
                : 'bg-[#F0F4FF] dark:bg-[#1e3570]/60 text-[#1a2a5e] dark:text-[#e2e8f0] rounded-tl-sm'
            )}>
              {msg.role === 'assistant' ? <MarkdownMessage content={msg.content} /> : msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-[#F0F4FF] dark:bg-[#1e3570] flex items-center justify-center">
              <Bot size={14} className="text-[#1B3A8C] dark:text-blue-300" />
            </div>
            <div className="bg-[#F0F4FF] dark:bg-[#1e3570]/60 rounded-xl rounded-tl-sm px-3 py-2 flex items-center gap-1">
              <Loader2 size={14} className="text-[#1B3A8C] dark:text-blue-300 animate-spin" />
              <span className="text-xs text-[#64748B] dark:text-[#94a3b8]">Digitando...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[#E2E8F0] dark:border-[#1e3570]">
        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Digite sua pergunta..."
            disabled={loading}
            className="flex-1 text-sm px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1e3570] bg-[#F8FAFC] dark:bg-[#0a1530] text-[#1a2a5e] dark:text-[#e2e8f0] focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] dark:focus:ring-blue-400 focus:border-transparent placeholder:text-[#94A3B8] dark:placeholder:text-[#94a3b8]"
          />
          <Button type="submit" size="icon" className="rounded-xl flex-shrink-0" disabled={!input.trim() || loading}>
            <Send size={14} />
          </Button>
        </form>
      </div>
    </div>
  )
}
