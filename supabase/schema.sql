-- ============================================================
-- LF Auditoria e Consultoria - Sistema de Análise Documental
-- Schema SQL para Supabase
-- Execute este script no SQL Editor do painel do Supabase
-- ============================================================

-- ── TABELAS ────────────────────────────────────────────────

-- Perfis de usuário (extensão da auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  role text not null default 'colaborador' check (role in ('admin', 'colaborador')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Temas de análise (OEA, LGPD, etc.)
create table if not exists public.themes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  color text not null default '#1B3A8C',
  icon text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Subtemas por tema
create table if not exists public.subtopics (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references public.themes(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Documentos de referência (materiais-base para IA)
create table if not exists public.reference_documents (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references public.themes(id) on delete cascade,
  subtopic_id uuid references public.subtopics(id) on delete set null,
  name text not null,
  description text,
  file_path text,
  file_type text,
  file_size integer,
  content text,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Análises realizadas
create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  theme_id uuid not null references public.themes(id),
  subtopic_id uuid references public.subtopics(id),
  client_name text,
  document_name text not null,
  document_path text,
  document_type text,
  document_content text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Relatórios gerados pela IA
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null unique references public.analyses(id) on delete cascade,
  overall_compliance text check (overall_compliance in ('conforme', 'parcialmente_conforme', 'nao_conforme')),
  compliance_score integer check (compliance_score between 0 and 100),
  summary text,
  criteria_used text,
  conforming_points jsonb not null default '[]',
  partial_points jsonb not null default '[]',
  non_conforming_points jsonb not null default '[]',
  improvement_suggestions jsonb not null default '[]',
  conclusion text,
  raw_analysis text,
  created_at timestamptz not null default now()
);

-- Mensagens do chat com IA
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

-- ── TRIGGER: auto-criar perfil ao registrar usuário ────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    'colaborador'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── ROW LEVEL SECURITY ─────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.themes enable row level security;
alter table public.subtopics enable row level security;
alter table public.reference_documents enable row level security;
alter table public.analyses enable row level security;
alter table public.reports enable row level security;
alter table public.chat_messages enable row level security;

-- Profiles
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_select_admin" on public.profiles for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_update_admin" on public.profiles for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Themes: todos autenticados leem; admins escrevem
create policy "themes_select" on public.themes for select using (auth.role() = 'authenticated');
create policy "themes_write_admin" on public.themes for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Subtopics
create policy "subtopics_select" on public.subtopics for select using (auth.role() = 'authenticated');
create policy "subtopics_write_admin" on public.subtopics for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Reference documents
create policy "refdocs_select" on public.reference_documents for select using (auth.role() = 'authenticated');
create policy "refdocs_write_admin" on public.reference_documents for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Analyses: usuário vê as suas; admin vê todas
create policy "analyses_select" on public.analyses for select using (
  user_id = auth.uid() or
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "analyses_insert" on public.analyses for insert with check (user_id = auth.uid());
create policy "analyses_update" on public.analyses for update using (user_id = auth.uid());

-- Reports (acompanham análises)
create policy "reports_select" on public.reports for select using (
  exists (
    select 1 from public.analyses a
    where a.id = analysis_id
    and (a.user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  )
);
create policy "reports_insert" on public.reports for insert with check (
  exists (select 1 from public.analyses a where a.id = analysis_id and a.user_id = auth.uid())
);

-- Chat messages
create policy "chat_select" on public.chat_messages for select using (
  exists (
    select 1 from public.analyses a
    where a.id = analysis_id
    and (a.user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  )
);
create policy "chat_insert" on public.chat_messages for insert with check (
  exists (select 1 from public.analyses a where a.id = analysis_id and a.user_id = auth.uid())
);

-- ── DADOS INICIAIS ─────────────────────────────────────────

insert into public.themes (name, description, color, icon) values
  ('OEA', 'Operador Econômico Autorizado — Certificação de conformidade aduaneira junto à Receita Federal do Brasil', '#1B3A8C', 'shield'),
  ('LGPD', 'Lei Geral de Proteção de Dados Pessoais — Lei nº 13.709/2018', '#16A34A', 'lock')
on conflict (name) do nothing;

-- Subtemas OEA
insert into public.subtopics (theme_id, name, description)
select t.id, s.name, s.description
from public.themes t,
(values
  ('Cadastramento e Habilitação', 'Processos de cadastramento e habilitação junto à Receita Federal do Brasil'),
  ('Cumprimento da Legislação Aduaneira', 'Conformidade com normas aduaneiras e tributárias vigentes'),
  ('Sistema de Gestão', 'Sistema de gestão e controles internos da organização'),
  ('Capacidade Financeira', 'Avaliação e comprovação da capacidade financeira do operador'),
  ('Segurança da Carga', 'Procedimentos de segurança no manuseio e transporte de cargas'),
  ('Segurança dos Processos', 'Controles de segurança nos processos operacionais e documentais'),
  ('Segurança Física', 'Medidas de segurança física das instalações e perímetros'),
  ('Segurança dos Parceiros Comerciais', 'Verificação e controle da cadeia de parceiros comerciais'),
  ('Segurança dos Funcionários', 'Procedimentos de segurança relacionados à gestão de pessoas'),
  ('Segurança da Tecnologia da Informação', 'Controles de segurança em Tecnologia da Informação')
) as s(name, description)
where t.name = 'OEA'
on conflict do nothing;

-- Subtemas LGPD
insert into public.subtopics (theme_id, name, description)
select t.id, s.name, s.description
from public.themes t,
(values
  ('Bases Legais para Tratamento', 'Fundamentos e bases legais para o tratamento de dados pessoais'),
  ('Direitos dos Titulares', 'Mecanismos para atendimento dos direitos dos titulares de dados'),
  ('Política de Privacidade', 'Política de privacidade e transparência no tratamento de dados'),
  ('Medidas de Segurança', 'Medidas técnicas e administrativas de segurança dos dados pessoais'),
  ('Relatório de Impacto (DPIA)', 'Relatório de Impacto à Proteção de Dados Pessoais'),
  ('Gestão de Incidentes', 'Procedimentos para gestão e notificação de incidentes de segurança'),
  ('Transferência Internacional de Dados', 'Requisitos para transferência internacional de dados pessoais'),
  ('Encarregado de Dados (DPO)', 'Designação e atribuições do Encarregado de Proteção de Dados'),
  ('Consentimento', 'Gestão, registro e revogação de consentimentos dos titulares'),
  ('Ciclo de Vida dos Dados', 'Controle do ciclo de vida, retenção e eliminação de dados pessoais')
) as s(name, description)
where t.name = 'LGPD'
on conflict do nothing;

-- ── STORAGE BUCKETS ────────────────────────────────────────
-- Execute separadamente no dashboard do Supabase > Storage:
-- 1. Crie o bucket "reference-documents" (privado)
-- 2. Crie o bucket "client-documents" (privado)
-- 3. Adicione policies de acesso conforme necessário
