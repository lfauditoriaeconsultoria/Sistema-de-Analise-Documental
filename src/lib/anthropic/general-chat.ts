import { getAnthropicClient } from './client'

const SYSTEM_PROMPT = `Você é um assistente especialista da LF Auditoria e Consultoria, com profundo conhecimento em:

- **OEA (Operador Econômico Autorizado)**: Programa da Receita Federal do Brasil (IN RFB Nº 2.318). Requisitos de habilitação nas modalidades Conformidade (OEA-C) e Segurança (OEA-S). Critérios de auditoria, processo de certificação e renovação, benefícios alfandegários.
- **LGPD (Lei Geral de Proteção de Dados)**: Lei 13.709/2018. Princípios do tratamento, bases legais, direitos dos titulares, obrigações de controladores e operadores, RIPD (Relatório de Impacto à Proteção de Dados Pessoais), DPO, incidentes de segurança e notificações à ANPD.
- **Compliance empresarial**: Gestão de riscos, controles internos, governança corporativa, normas ABNT NBR ISO 37301, programas de integridade.
- **Legislação aduaneira e tributária**: Regulamento Aduaneiro (Decreto nº 6.759/2009), normas da RFB, regimes aduaneiros especiais, drawback, admissão temporária.
- **Auditoria interna**: Metodologias de auditoria, análise documental, identificação de não conformidades, emissão de relatórios técnicos.

Ao responder:
- Use linguagem técnica e formal em português brasileiro
- Aplique formatação markdown: **negrito** para termos-chave, listas para enumerações, ## para títulos em respostas longas
- Cite normas, artigos e referências legais quando relevante (ex: "conforme art. 7º, inc. II da Lei 13.709/2018")
- Seja preciso e objetivo; evite respostas genéricas
- Quando o usuário anexar documentos, referencie trechos específicos nas suas respostas
- Se uma pergunta estiver fora do seu escopo de especialidade, informe claramente`

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'; data: string } }

export interface ChatAttachment {
  name: string
  type: 'text' | 'image'
  content: string
  mediaType?: string
}

const VALID_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
type ValidImageType = typeof VALID_IMAGE_TYPES[number]

function buildCurrentUserContent(text: string, attachments: ChatAttachment[]): string | ContentBlock[] {
  const images = attachments.filter(a => a.type === 'image')
  const docs = attachments.filter(a => a.type === 'text')

  let userText = text
  if (docs.length > 0) {
    const ctx = docs.map(d => `### Arquivo: ${d.name}\n${d.content}`).join('\n\n')
    userText += `\n\n---\n## Documentos Anexados\n${ctx}`
  }

  if (images.length === 0) return userText

  const blocks: ContentBlock[] = [
    ...images.map(img => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: (VALID_IMAGE_TYPES.includes(img.mediaType as ValidImageType)
          ? img.mediaType
          : 'image/jpeg') as ValidImageType,
        data: img.content,
      },
    })),
    { type: 'text', text: userText },
  ]
  return blocks
}

export interface KnowledgeBaseDoc {
  name: string
  version?: string | null
  content: string
}

export interface KnowledgeBaseLink {
  name: string
  url: string
  content: string
}

export async function generalChat(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  newUserText: string,
  attachments: ChatAttachment[] = [],
  restrictToContext?: boolean,
  knowledgeBaseDocs: KnowledgeBaseDoc[] = [],
  knowledgeBaseLinks: KnowledgeBaseLink[] = [],
): Promise<string> {
  const client = getAnthropicClient()

  // Always inject knowledge base documents when available
  const kbSection = knowledgeBaseDocs.length > 0
    ? `\n\n## Base de Conhecimento do Sistema\nOs materiais abaixo foram cadastrados pelo administrador e devem ser usados como referência primária nas respostas:\n\n${knowledgeBaseDocs.map(d => {
        const label = d.version ? `${d.name} (${d.version})` : d.name
        return `### ${label}\n${d.content}`
      }).join('\n\n')}`
    : ''

  const linksSection = knowledgeBaseLinks.length > 0
    ? `\n\n## Links Externos Cadastrados\nOs conteúdos abaixo foram extraídos de páginas web cadastradas pelo administrador:\n\n${knowledgeBaseLinks.map(l =>
        `### ${l.name} (${l.url})\n${l.content}`
      ).join('\n\n')}`
    : ''

  const restrictionNote = restrictToContext
    ? `\n\n## ⚠️ MODO RESTRITO — Apenas Base de Conhecimento Fornecida\nIMPORTANTE: Responda EXCLUSIVAMENTE com base nos materiais da Base de Conhecimento do Sistema listados acima e nos documentos que o usuário enviar nesta conversa. Não utilize seu conhecimento de treinamento externo que não esteja explicitamente nesses materiais. Se a informação não constar, responda: "Esta informação não está disponível na base de conhecimento fornecida."`
    : ''

  // Build system blocks: cacheable static+KB block + optional variable restriction block
  type SysBlock = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }

  const systemBlocks: SysBlock[] = [
    {
      type: 'text',
      text: SYSTEM_PROMPT + kbSection + linksSection,
      cache_control: { type: 'ephemeral' },
    },
  ]

  if (restrictionNote) {
    systemBlocks.push({ type: 'text', text: restrictionNote })
  }

  const messages: Array<{ role: 'user' | 'assistant'; content: string | ContentBlock[] }> = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: buildCurrentUserContent(newUserText, attachments) },
  ]

  const response = await client.messages.create(
    {
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemBlocks as Parameters<typeof client.messages.create>[0]['system'],
      messages: messages as Parameters<typeof client.messages.create>[0]['messages'],
    },
    { headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' } },
  )

  return response.content[0].type === 'text' ? response.content[0].text : ''
}
