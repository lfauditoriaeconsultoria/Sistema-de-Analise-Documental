import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge, ComplianceBadge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  FileText, CheckCircle, Clock,
  FilePlus, BookOpen, ArrowRight, Shield, Lock
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { Analysis, Report } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  const query = supabase
    .from('analyses')
    .select('*, theme:themes(name, color), subtopic:subtopics(name), report:reports(*)')
    .order('created_at', { ascending: false })

  const { data: analyses } = isAdmin
    ? await query.limit(5)
    : await query.eq('user_id', user!.id).limit(5)

  const statsQuery = supabase.from('analyses').select('status, report:reports(overall_compliance)')
  const { data: allAnalyses } = isAdmin
    ? await statsQuery
    : await statsQuery.eq('user_id', user!.id)

  const total     = allAnalyses?.length ?? 0
  const completed = allAnalyses?.filter(a => a.status === 'completed').length ?? 0
  const pending   = allAnalyses?.filter(a => ['pending', 'processing'].includes(a.status)).length ?? 0

  const { data: themes } = await createAdminClient().from('themes').select('*').eq('is_active', true)

  const stats = [
    { label: 'Total de Análises', value: total,     icon: <FileText size={20} />,    color: '#1B3A8C', bg: '#EEF2FF' },
    { label: 'Concluídas',        value: completed, icon: <CheckCircle size={20} />, color: '#16A34A', bg: '#DCFCE7' },
    { label: 'Em Andamento',      value: pending,   icon: <Clock size={20} />,       color: '#D97706', bg: '#FEF3C7' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div className="lf-gradient rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Olá, {profile?.full_name?.split(' ')[0] ?? 'Colaborador'}!</h2>
            <p className="text-blue-200 mt-1 text-sm">
              Bem-vindo ao sistema de análise documental com IA da LF Consultoria.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Link href="/analysis/new">
              <Button variant="secondary" size="md" className="gap-2 bg-white text-[#1B3A8C] hover:bg-blue-50 dark:bg-white dark:text-[#1B3A8C]">
                <FilePlus size={16} /> Nova Análise
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(stat => (
          <Card key={stat.label} className="flex flex-col items-center text-center gap-3 py-6">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: stat.bg, color: stat.color }}>
              {stat.icon}
            </div>
            <div>
              <p className="text-2xl font-bold text-[#1a2a5e] dark:text-[#e2e8f0]">{stat.value}</p>
              <p className="text-xs text-[#64748B] dark:text-[#94a3b8] mt-0.5">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Themes Quick Access */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Temas Disponíveis</CardTitle>
            <Badge variant="muted">{themes?.length ?? 0} temas</Badge>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {themes?.map(theme => (
                <Link key={theme.id} href={`/analysis/new?theme=${theme.id}`}>
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-[#E2E8F0] dark:border-[#1e3570] hover:border-[#1B3A8C] dark:hover:border-blue-400 hover:bg-[#F0F4FF] dark:hover:bg-[#1e3570]/40 transition-all group">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                      style={{ backgroundColor: theme.color ?? '#1B3A8C' }}>
                      {theme.name === 'OEA' ? <Shield size={18} /> : <Lock size={18} />}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-[#1a2a5e] dark:text-[#e2e8f0]">{theme.name}</p>
                      <p className="text-xs text-[#64748B] dark:text-[#94a3b8] line-clamp-1">{theme.description}</p>
                    </div>
                    <ArrowRight size={14} className="text-[#94A3B8] group-hover:text-[#1B3A8C] dark:group-hover:text-blue-400 transition-colors" />
                  </div>
                </Link>
              ))}
              <Link href="/reference-docs" className="flex items-center gap-2 p-3 text-sm text-[#1B3A8C] dark:text-blue-400 hover:bg-[#F0F4FF] dark:hover:bg-[#1e3570]/40 rounded-xl transition-colors">
                <BookOpen size={16} />
                <span>Acessar base de conhecimento</span>
                <ArrowRight size={14} className="ml-auto" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Recent Analyses */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Análises Recentes</CardTitle>
            <Link href="/analysis/history">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">Ver todas <ArrowRight size={12} /></Button>
            </Link>
          </CardHeader>
          <CardContent>
            {!analyses || analyses.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-14 h-14 rounded-2xl bg-[#F0F4FF] dark:bg-[#1e3570]/30 flex items-center justify-center mx-auto mb-3">
                  <FileText size={24} className="text-[#1B3A8C] dark:text-blue-400" />
                </div>
                <p className="text-[#64748B] dark:text-[#94a3b8] text-sm font-medium">Nenhuma análise realizada</p>
                <p className="text-[#94A3B8] dark:text-[#94a3b8] text-xs mt-1">Comece criando uma nova análise</p>
                <Link href="/analysis/new" className="inline-block mt-3">
                  <Button size="sm"><FilePlus size={14} /> Nova Análise</Button>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {(analyses as Array<Analysis & { report: Report[] | null }>).map(analysis => {
                  const report = Array.isArray(analysis.report) ? analysis.report[0] : analysis.report
                  return (
                    <Link key={analysis.id} href={`/analysis/${analysis.id}`}>
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-[#E2E8F0] dark:border-[#1e3570] hover:border-[#1B3A8C] dark:hover:border-blue-400 hover:bg-[#F8FAFC] dark:hover:bg-[#1e3570]/30 transition-all">
                        <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] dark:bg-[#1e3570]/60 flex items-center justify-center flex-shrink-0">
                          <FileText size={18} className="text-[#1B3A8C] dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-[#1a2a5e] dark:text-[#e2e8f0] truncate">{analysis.document_name}</p>
                          <p className="text-xs text-[#64748B] dark:text-[#94a3b8]">
                            {(analysis.theme as unknown as { name: string })?.name}
                            {(analysis.subtopic as unknown as { name: string })?.name && ` › ${(analysis.subtopic as unknown as { name: string }).name}`}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {report?.overall_compliance
                            ? <ComplianceBadge level={report.overall_compliance} />
                            : <StatusBadge status={analysis.status} />
                          }
                          <p className="text-xs text-[#94A3B8] dark:text-[#94a3b8]">{formatDate(analysis.created_at)}</p>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/analysis/new">
          <Card hover className="flex flex-col items-center text-center gap-3 py-6">
            <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] dark:bg-[#1e3570]/60 flex items-center justify-center">
              <FilePlus size={22} className="text-[#1B3A8C] dark:text-blue-400" />
            </div>
            <div>
              <p className="font-semibold text-sm text-[#1a2a5e] dark:text-[#e2e8f0]">Nova Análise</p>
              <p className="text-xs text-[#64748B] dark:text-[#94a3b8] mt-0.5">Analisar documento de cliente</p>
            </div>
          </Card>
        </Link>
        <Link href="/analysis/history">
          <Card hover className="flex flex-col items-center text-center gap-3 py-6">
            <div className="w-12 h-12 rounded-2xl bg-[#DCFCE7] dark:bg-green-900/30 flex items-center justify-center">
              <Clock size={22} className="text-[#16A34A] dark:text-green-400" />
            </div>
            <div>
              <p className="font-semibold text-sm text-[#1a2a5e] dark:text-[#e2e8f0]">Histórico</p>
              <p className="text-xs text-[#64748B] dark:text-[#94a3b8] mt-0.5">Consultar análises anteriores</p>
            </div>
          </Card>
        </Link>
        <Link href="/reference-docs">
          <Card hover className="flex flex-col items-center text-center gap-3 py-6">
            <div className="w-12 h-12 rounded-2xl bg-[#FEF3C7] dark:bg-amber-900/30 flex items-center justify-center">
              <BookOpen size={22} className="text-[#D97706] dark:text-amber-400" />
            </div>
            <div>
              <p className="font-semibold text-sm text-[#1a2a5e] dark:text-[#e2e8f0]">Base de Conhecimento</p>
              <p className="text-xs text-[#64748B] dark:text-[#94a3b8] mt-0.5">Gerenciar materiais de referência</p>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  )
}
