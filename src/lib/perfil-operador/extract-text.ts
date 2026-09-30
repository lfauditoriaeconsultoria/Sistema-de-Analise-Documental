// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as typeof import('pdf-parse')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require('mammoth') as typeof import('mammoth')

/**
 * Extrai texto de um documento (PDF/DOCX/DOC/TXT/MD/CSV) a partir do buffer baixado
 * do storage. Mesmo conjunto de formatos aceitos em /api/checklist/generate.
 * Limite de 40k chars por documento — generoso o suficiente para políticas e
 * procedimentos completos, sem arriscar estourar o contexto quando vários
 * documentos forem vinculados ao mesmo item.
 */
export async function extractDocumentText(buffer: Buffer, filename: string, maxChars = 40_000): Promise<string | null> {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''

  try {
    if (ext === 'pdf') {
      const data = await pdfParse(buffer)
      const text = (data.text ?? '').trim()
      return text.length >= 20 ? truncate(text, maxChars) : null
    }
    if (ext === 'docx' || ext === 'doc') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await mammoth.extractRawText({ buffer: buffer as any })
      const text = result.value.trim()
      return text.length >= 20 ? truncate(text, maxChars) : null
    }
    if (['txt', 'md', 'csv'].includes(ext)) {
      const text = buffer.toString('utf-8').trim()
      return text.length >= 1 ? truncate(text, maxChars) : null
    }
  } catch (err) {
    console.warn(`[perfil-operador] falha ao extrair texto de ${filename}:`, err)
    return null
  }

  // Formatos sem extração de texto (imagens, planilhas etc.) — sem suporte ainda.
  return null
}

function truncate(text: string, maxChars: number): string {
  return text.length > maxChars
    ? text.slice(0, maxChars) + '\n[... documento truncado para otimizar processamento ...]'
    : text
}
