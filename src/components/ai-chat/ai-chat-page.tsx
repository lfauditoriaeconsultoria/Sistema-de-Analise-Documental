'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  Bot, Plus, Trash2, Send, Paperclip, X,
  FileText, Image as ImageIcon, Loader2, MessageSquare,
  File as FileIcon, Shield, Scale, BookOpen, Globe, DatabaseZap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AiChatConversation, AiChatMessage } from '@/types'

// ─── Markdown renderer ────────────────────────────────────────────────────────

function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i}>{part.slice(2, -2)}</strong>
        if (part.startsWith('`') && part.endsWith('`'))
          return (
            <code key={i} className="px-1 py-0.5 rounded text-xs bg-[#1B3A8C]/10 dark:bg-white/10 font-mono">
              {part.slice(1, -1)}
            </code>
          )
        return part
      })}
    </>
  )
}

function MarkdownMessage({ content }: { content: string }) {
  const lines = content.split('\n')
  const nodes: React.ReactNode[] = []
  const pendingList: React.ReactNode[] = []

  function flushList() {
    if (pendingList.length === 0) return
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="ml-4 my-1.5 space-y-1 list-disc list-outside text-sm">
        {pendingList.splice(0)}
      </ul>
    )
  }

  lines.forEach((line, i) => {
    if (/^### /.test(line)) {
      flushList()
      nodes.push(<p key={i} className="font-semibold text-sm mt-3 mb-1 text-[#1B3A8C] dark:text-blue-300">{inlineFormat(line.slice(4))}</p>)
    } else if (/^## /.test(line)) {
      flushList()
      nodes.push(<p key={i} className="font-bold text-base mt-4 mb-1.5 text-[#1a2a5e] dark:text-blue-200">{inlineFormat(line.slice(3))}</p>)
    } else if (/^# /.test(line)) {
      flushList()
      nodes.push(<p key={i} className="font-bold text-lg mt-4 mb-2 text-[#1a2a5e] dark:text-blue-200">{inlineFormat(line.slice(2))}</p>)
    } else if (/^[-*] /.test(line)) {
      pendingList.push(<li key={i} className="leading-relaxed">{inlineFormat(line.slice(2))}</li>)
    } else if (/^\d+\. /.test(line)) {
      flushList()
      const match = line.match(/^(\d+)\. (.*)/)
      if (match) {
        nodes.push(
          <div key={i} className="flex gap-2 my-0.5 text-sm">
            <span className="font-semibold text-[#1B3A8C] dark:text-blue-300 flex-shrink-0">{match[1]}.</span>
            <span className="leading-relaxed">{inlineFormat(match[2])}</span>
          </div>
        )
      }
    } else if (/^---+$/.test(line.trim())) {
      flushList()
      nodes.push(<hr key={i} className="my-3 border-current opacity-10" />)
    } else if (line.trim() === '') {
      flushList()
      if (nodes.length > 0) nodes.push(<div key={i} className="h-2" />)
    } else {
      flushList()
      nodes.push(<p key={i} className="text-sm leading-relaxed">{inlineFormat(line)}</p>)
    }
  })
  flushList()

  return <div className="space-y-0.5">{nodes}</div>
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PendingAttachment {
  id: string
  name: string
  fileType: 'text' | 'image' | 'unknown'
  content: string
  mediaType?: string
  size: number
  uploading: boolean
  error?: string
}

interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  attachmentNames?: string[]
  pending?: boolean
}

// ─── Suggestion cards shown on empty state ────────────────────────────────────

const SUGGESTIONS = [
  { icon: <Shield size={16} />, text: 'O que é programa OEA e quais seus benefícios?' },
  { icon: <Scale size={16} />, text: 'Como classificar dados pessoais e dados sensíveis?' },
  { icon: <BookOpen size={16} />, text: 'O que não pode faltar em uma política de backup para auditoria OEA?' },
  { icon: <FileText size={16} />, text: 'Como funciona a anonimização de dados?' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return 'Hoje'
  if (diffDays === 1) return 'Ontem'
  if (diffDays < 7) return `${diffDays} dias atrás`
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AiChatPage() {
  const [conversations, setConversations] = useState<AiChatConversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<PendingAttachment[]>([])
  const [sending, setSending] = useState(false)
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [useExternalKnowledge, setUseExternalKnowledge] = useState(true)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function getToken(): Promise<string | null> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  function authHeaders(token: string | null): Record<string, string> {
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  // Fetch conversation list
  const fetchConversations = useCallback(async () => {
    const token = await getToken()
    const res = await fetch('/api/ai-chat/conversations', {
      headers: authHeaders(token),
    })
    if (!res.ok) return
    const json = await res.json()
    setConversations(json.conversations ?? [])
    setLoadingConvs(false)
  }, [])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  // Fetch messages for active conversation
  useEffect(() => {
    if (!activeId) { setMessages([]); return }
    setLoadingMsgs(true)

    getToken().then(token =>
      fetch(`/api/ai-chat/conversations/${activeId}`, {
        headers: authHeaders(token),
      })
    ).then(res => res.json()).then(json => {
      const msgs: UIMessage[] = (json.messages ?? []).map((m: AiChatMessage) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        attachmentNames: m.attachments.map(a => a.name),
      }))
      setMessages(msgs)
    }).finally(() => setLoadingMsgs(false))
  }, [activeId])

  // Create new conversation and activate it
  async function startNewConversation() {
    setActiveId(null)
    setMessages([])
    setInput('')
    setAttachments([])
  }

  // Delete a conversation
  async function deleteConversation(convId: string, e: React.MouseEvent) {
    e.stopPropagation()
    setDeletingId(convId)
    const token = await getToken()
    await fetch(`/api/ai-chat/conversations/${convId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    })
    setConversations(prev => prev.filter(c => c.id !== convId))
    if (activeId === convId) {
      setActiveId(null)
      setMessages([])
    }
    setDeletingId(null)
  }

  // Handle file selection
  async function handleFileSelect(files: FileList | null) {
    if (!files) return
    const token = await getToken()

    Array.from(files).forEach(async file => {
      const pendingId = `${Date.now()}-${Math.random()}`
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)
      const isSupported = ['pdf', 'docx', 'txt', 'csv'].includes(ext) || isImage

      if (!isSupported) {
        setAttachments(prev => [...prev, {
          id: pendingId,
          name: file.name,
          fileType: 'unknown',
          content: '',
          size: file.size,
          uploading: false,
          error: `Formato .${ext} não suportado`,
        }])
        return
      }

      setAttachments(prev => [...prev, {
        id: pendingId,
        name: file.name,
        fileType: isImage ? 'image' : 'text',
        content: '',
        size: file.size,
        uploading: true,
      }])

      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/ai-chat/upload', {
          method: 'POST',
          headers: authHeaders(token),
          body: formData,
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)

        setAttachments(prev => prev.map(a =>
          a.id === pendingId
            ? { ...a, content: json.content, fileType: json.type, mediaType: json.mediaType, uploading: false }
            : a
        ))
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro ao processar arquivo'
        setAttachments(prev => prev.map(a =>
          a.id === pendingId ? { ...a, uploading: false, error: msg } : a
        ))
      }
    })
  }

  // Send message
  async function sendMessage(textOverride?: string) {
    const text = (textOverride ?? input).trim()
    if (!text || sending) return
    const pendingAttachments = attachments.filter(a => !a.uploading && !a.error && a.content)
    if (attachments.some(a => a.uploading)) return // wait for uploads

    setSending(true)
    setInput('')
    setAttachments([])

    // Add user message to UI immediately
    const tempUserId = `temp-user-${Date.now()}`
    const tempAiId = `temp-ai-${Date.now()}`
    setMessages(prev => [
      ...prev,
      {
        id: tempUserId,
        role: 'user',
        content: text,
        attachmentNames: pendingAttachments.map(a => a.name),
      },
      { id: tempAiId, role: 'assistant', content: '', pending: true },
    ])

    try {
      const token = await getToken()
      let convId = activeId

      // Create conversation on first message
      if (!convId) {
        const createRes = await fetch('/api/ai-chat/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
          body: JSON.stringify({ title: text.length > 60 ? text.slice(0, 57) + '...' : text }),
        })
        const createJson = await createRes.json()
        convId = createJson.conversation.id
        setActiveId(convId)
        setConversations(prev => [createJson.conversation, ...prev])
      }

      const res = await fetch(`/api/ai-chat/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({
          content: text,
          useExternalKnowledge,
          attachments: pendingAttachments.map(a => ({
            name: a.name,
            type: a.fileType,
            content: a.content,
            mediaType: a.mediaType,
          })),
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      // Replace temp messages with real ones from DB
      setMessages(prev => prev
        .filter(m => m.id !== tempUserId && m.id !== tempAiId)
        .concat([
          {
            id: json.userMessage.id,
            role: 'user',
            content: json.userMessage.content,
            attachmentNames: pendingAttachments.map(a => a.name),
          },
          {
            id: json.assistantMessage.id,
            role: 'assistant',
            content: json.assistantMessage.content,
          },
        ])
      )

      // Update conversation title in sidebar if it was auto-generated
      setConversations(prev => prev.map(c =>
        c.id === convId
          ? { ...c, title: text.length > 60 ? text.slice(0, 57) + '...' : text, updated_at: new Date().toISOString() }
          : c
      ))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar mensagem'
      setMessages(prev => prev
        .filter(m => m.id !== tempAiId)
        .map(m => m.id === tempUserId ? m : m)
        .concat([{
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `Desculpe, ocorreu um erro: ${msg}. Tente novamente.`,
        }])
      )
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const canSend = input.trim().length > 0 && !sending && !attachments.some(a => a.uploading)

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex -m-6 overflow-hidden bg-white dark:bg-[#080f2a]" style={{ height: 'calc(100vh - 56px)' }}>

      {/* ── Left panel: conversation list ── */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-[#E2E8F0] dark:border-[#1e3570] bg-[#F8FAFC] dark:bg-[#0a1530]">
        <div className="p-3 border-b border-[#E2E8F0] dark:border-[#1e3570]">
          <button
            onClick={startNewConversation}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#1B3A8C] hover:bg-[#1e44a8] text-white text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            <span>Nova conversa</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {loadingConvs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={18} className="text-[#94A3B8] animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-xs text-[#94A3B8] dark:text-[#475569] text-center py-8 px-4">
              Nenhuma conversa ainda. Inicie uma nova!
            </p>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                role="button"
                tabIndex={0}
                onClick={() => setActiveId(conv.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setActiveId(conv.id) }}
                className={cn(
                  'w-full text-left px-3 py-2.5 rounded-lg group flex items-start gap-2 transition-colors cursor-pointer',
                  activeId === conv.id
                    ? 'bg-[#1B3A8C]/10 dark:bg-[#1e3570]'
                    : 'hover:bg-[#F0F4FF] dark:hover:bg-[#0f1d42]'
                )}
              >
                <MessageSquare
                  size={14}
                  className={cn(
                    'mt-0.5 flex-shrink-0',
                    activeId === conv.id ? 'text-[#1B3A8C] dark:text-blue-300' : 'text-[#94A3B8]'
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-xs font-medium truncate leading-tight',
                    activeId === conv.id
                      ? 'text-[#1B3A8C] dark:text-blue-300'
                      : 'text-[#334155] dark:text-[#cbd5e1]'
                  )}>
                    {conv.title}
                  </p>
                  <p className="text-[10px] text-[#94A3B8] dark:text-[#475569] mt-0.5">
                    {formatRelativeDate(conv.updated_at)}
                  </p>
                </div>
                <button
                  onClick={e => deleteConversation(conv.id, e)}
                  disabled={deletingId === conv.id}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[#94A3B8] hover:text-red-500 transition-all flex-shrink-0"
                >
                  {deletingId === conv.id
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Trash2 size={12} />
                  }
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-3.5 border-b border-[#E2E8F0] dark:border-[#1e3570] bg-white dark:bg-[#0a1530]">
          <div className="w-8 h-8 rounded-full lf-gradient flex items-center justify-center flex-shrink-0">
            <Bot size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#1a2a5e] dark:text-white">Consultor IA</p>
            <p className="text-xs text-[#64748B] dark:text-[#94a3b8]">Especialista em OEA · LGPD · Compliance</p>
          </div>

          {/* Knowledge source toggle */}
          <button
            type="button"
            onClick={() => setUseExternalKnowledge(prev => !prev)}
            title={useExternalKnowledge
              ? 'Conhecimento externo habilitado — clique para restringir à base local'
              : 'Restrito à base local — clique para habilitar conhecimento externo'}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all flex-shrink-0',
              useExternalKnowledge
                ? 'border-[#1B3A8C] bg-[#EEF2FF] dark:bg-[#1e3570]/60 text-[#1B3A8C] dark:text-blue-300'
                : 'border-[#E2E8F0] dark:border-[#475569] bg-[#F8FAFC] dark:bg-[#0f1d42] text-[#64748B] dark:text-[#94a3b8]'
            )}
          >
            {useExternalKnowledge
              ? <><Globe size={13} /><span className="hidden sm:inline">Conhecimento externo</span></>
              : <><DatabaseZap size={13} /><span className="hidden sm:inline">Base local</span></>
            }
            <div className={cn(
              'relative w-8 h-4 rounded-full transition-colors',
              useExternalKnowledge ? 'bg-[#1B3A8C]' : 'bg-[#CBD5E1] dark:bg-[#475569]'
            )}>
              <span className={cn(
                'absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform',
                useExternalKnowledge ? 'translate-x-4' : 'translate-x-0.5'
              )} />
            </div>
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {!activeId && messages.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
              <div className="w-16 h-16 rounded-2xl lf-gradient flex items-center justify-center mb-5 shadow-lg">
                <Bot size={28} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-[#1a2a5e] dark:text-white mb-2">
                Consultor IA LF Consultoria
              </h2>
              <p className="text-sm text-[#64748B] dark:text-[#94a3b8] mb-8 max-w-md">
                Tire dúvidas sobre OEA, LGPD, compliance e auditoria. Você pode enviar documentos para análise e consulta.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(s.text); inputRef.current?.focus() }}
                    className="flex items-start gap-3 p-4 rounded-xl border border-[#E2E8F0] dark:border-[#1e3570] bg-[#F8FAFC] dark:bg-[#0f1d42] hover:border-[#1B3A8C] dark:hover:border-blue-400 hover:bg-[#F0F4FF] dark:hover:bg-[#1e3570]/40 text-left transition-all group"
                  >
                    <span className="text-[#1B3A8C] dark:text-blue-300 mt-0.5 flex-shrink-0">{s.icon}</span>
                    <span className="text-xs text-[#334155] dark:text-[#cbd5e1] leading-relaxed group-hover:text-[#1B3A8C] dark:group-hover:text-blue-300 transition-colors">
                      {s.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : loadingMsgs ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={24} className="text-[#1B3A8C] dark:text-blue-300 animate-spin" />
            </div>
          ) : (
            <div className="px-4 py-6 space-y-6 max-w-3xl mx-auto w-full">
              {messages.map(msg => (
                <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                  {/* Avatar */}
                  <div className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                    msg.role === 'user'
                      ? 'bg-[#1B3A8C]'
                      : 'bg-[#F0F4FF] dark:bg-[#1e3570] border border-[#E2E8F0] dark:border-[#2a4a9e]'
                  )}>
                    {msg.role === 'user'
                      ? <span className="text-white text-xs font-bold">V</span>
                      : <Bot size={14} className="text-[#1B3A8C] dark:text-blue-300" />
                    }
                  </div>

                  {/* Bubble */}
                  <div className={cn(
                    'max-w-[75%] rounded-2xl px-4 py-3',
                    msg.role === 'user'
                      ? 'bg-[#1B3A8C] text-white rounded-tr-sm'
                      : 'bg-[#F8FAFC] dark:bg-[#0f1d42] border border-[#E2E8F0] dark:border-[#1e3570] text-[#1a2a5e] dark:text-[#e2e8f0] rounded-tl-sm'
                  )}>
                    {/* Attachment chips */}
                    {msg.attachmentNames && msg.attachmentNames.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {msg.attachmentNames.map((name, i) => {
                          const ext = name.split('.').pop()?.toLowerCase() ?? ''
                          const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)
                          return (
                            <span
                              key={i}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-white/20 dark:bg-white/10"
                            >
                              {isImage ? <ImageIcon size={10} /> : <FileText size={10} />}
                              <span className="max-w-[120px] truncate">{name}</span>
                            </span>
                          )
                        })}
                      </div>
                    )}

                    {/* Content */}
                    {msg.pending ? (
                      <div className="flex items-center gap-1.5">
                        <Loader2 size={13} className="text-[#1B3A8C] dark:text-blue-300 animate-spin" />
                        <span className="text-xs text-[#64748B] dark:text-[#94a3b8]">Digitando...</span>
                      </div>
                    ) : msg.role === 'assistant' ? (
                      <MarkdownMessage content={msg.content} />
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* ── Input area ── */}
        <div className="px-4 pb-4 pt-2 border-t border-[#E2E8F0] dark:border-[#1e3570] bg-white dark:bg-[#0a1530]">
          <div className="max-w-3xl mx-auto">
            {/* Pending attachments */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachments.map(att => (
                  <div
                    key={att.id}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors',
                      att.error
                        ? 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400'
                        : 'border-[#E2E8F0] dark:border-[#1e3570] bg-[#F8FAFC] dark:bg-[#0f1d42] text-[#334155] dark:text-[#cbd5e1]'
                    )}
                  >
                    {att.uploading ? (
                      <Loader2 size={12} className="animate-spin text-[#1B3A8C] dark:text-blue-300" />
                    ) : att.error ? (
                      <X size={12} className="text-red-500" />
                    ) : att.fileType === 'image' ? (
                      <ImageIcon size={12} className="text-[#1B3A8C] dark:text-blue-300" />
                    ) : (
                      <FileIcon size={12} className="text-[#1B3A8C] dark:text-blue-300" />
                    )}
                    <span className="max-w-[140px] truncate font-medium">{att.name}</span>
                    {!att.uploading && <span className="text-[#94A3B8] dark:text-[#475569]">{formatFileSize(att.size)}</span>}
                    {att.error && <span className="text-red-500">· {att.error}</span>}
                    <button
                      onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
                      className="ml-0.5 text-[#94A3B8] hover:text-[#475569] dark:hover:text-white transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input box */}
            <div className="flex items-end gap-2 p-2 rounded-2xl border border-[#E2E8F0] dark:border-[#1e3570] bg-[#F8FAFC] dark:bg-[#0f1d42] focus-within:border-[#1B3A8C] dark:focus-within:border-blue-400 transition-colors">
              {/* Attach button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Anexar arquivo"
                className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#1B3A8C] dark:hover:text-blue-300 hover:bg-[#F0F4FF] dark:hover:bg-[#1e3570]/40 transition-colors flex-shrink-0 mb-0.5"
              >
                <Paperclip size={18} />
              </button>

              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte sobre OEA, LGPD, compliance... (Enter para enviar, Shift+Enter para nova linha)"
                disabled={sending}
                rows={1}
                className="flex-1 text-sm bg-transparent text-[#1a2a5e] dark:text-[#e2e8f0] placeholder:text-[#94A3B8] dark:placeholder:text-[#475569] focus:outline-none resize-none leading-relaxed py-1.5 max-h-40 overflow-y-auto"
                style={{ minHeight: '36px' }}
                onInput={e => {
                  const t = e.target as HTMLTextAreaElement
                  t.style.height = 'auto'
                  t.style.height = `${Math.min(t.scrollHeight, 160)}px`
                }}
              />

              <Button
                type="button"
                size="icon"
                disabled={!canSend}
                onClick={() => sendMessage()}
                className="rounded-xl flex-shrink-0 w-9 h-9 mb-0.5"
              >
                <Send size={15} />
              </Button>
            </div>

            <p className="text-[10px] text-[#94A3B8] dark:text-[#475569] text-center mt-2">
              Suporta PDF, DOCX, TXT, CSV e imagens · Enter para enviar
            </p>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp"
        className="hidden"
        onChange={e => handleFileSelect(e.target.files)}
        onClick={e => { (e.target as HTMLInputElement).value = '' }}
      />
    </div>
  )
}
