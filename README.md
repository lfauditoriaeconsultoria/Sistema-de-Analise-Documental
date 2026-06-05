# LF Auditoria — Sistema de Análise Documental com IA

Plataforma web interna para análise automatizada de documentos de clientes utilizando Inteligência Artificial (Claude da Anthropic), com foco em **OEA** (Operador Econômico Autorizado) e **LGPD**.

---

## Pré-requisitos

- Node.js 20+
- Conta no [Supabase](https://supabase.com) (gratuita)
- Chave de API da [Anthropic](https://console.anthropic.com)

---

## Configuração

### 1. Banco de dados (Supabase)

1. Crie um projeto no [supabase.com](https://supabase.com)
2. Acesse **SQL Editor** e execute o arquivo `supabase/schema.sql`
3. Vá em **Storage** e crie o bucket `reference-documents` (privado)
4. Em **Settings > Authentication**, configure o site URL para `http://localhost:3000`

### 2. Variáveis de ambiente

```bash
cp .env.example .env.local
```

Edite `.env.local` com suas credenciais do Supabase e Anthropic.

### 3. Instalar e iniciar

```bash
npm install
npm run dev
```

Acesse: **http://localhost:3000**

---

## Primeiro uso

1. Crie sua conta em `/register`
2. No Supabase, defina `role = 'admin'` na tabela `profiles` para seu usuário
3. Acesse `/admin` para gerenciar o sistema
4. Em **Documentos de Referência**, faça upload dos materiais-base (normas, legislação)
5. Crie sua primeira análise em **Nova Análise**

---

## Funcionalidades

| Funcionalidade | Status |
|---|---|
| Cadastro/login com Supabase Auth | OK |
| Controle de acesso (admin/colaborador) | OK |
| Painel com estatísticas de conformidade | OK |
| Seleção de tema (OEA / LGPD) e subtema | OK |
| Upload de documento (PDF, DOCX, TXT) | OK |
| Análise automática com IA (Claude Sonnet) | OK |
| Relatório técnico detalhado | OK |
| Score e classificação de conformidade | OK |
| Pontos conformes / parciais / não conformes | OK |
| Sugestões de melhoria priorizadas | OK |
| Histórico com filtros por tema e status | OK |
| Chatbot / assistente por análise | OK |
| Gestão de documentos de referência | OK |
| Painel administrativo | OK |

---

## Tecnologias

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Estilo**: Tailwind CSS v4
- **Banco**: Supabase (PostgreSQL + Auth + Storage)
- **IA**: Anthropic Claude Sonnet 4.6
- **Parsing**: pdf-parse, mammoth (DOCX)
- **UI**: Radix UI + Lucide React
