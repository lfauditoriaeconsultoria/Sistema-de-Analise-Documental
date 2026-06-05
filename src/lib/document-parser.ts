// pdfjs-dist (usado pelo pdf-parse) requer DOMMatrix, que não existe no Node.js
/* eslint-disable @typescript-eslint/no-explicit-any */
if (typeof (globalThis as any).DOMMatrix === 'undefined') {
  ;(globalThis as any).DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0
    m11 = 1; m12 = 0; m13 = 0; m14 = 0
    m21 = 0; m22 = 1; m23 = 0; m24 = 0
    m31 = 0; m32 = 0; m33 = 1; m34 = 0
    m41 = 0; m42 = 0; m43 = 0; m44 = 1
    is2D = true; isIdentity = true
    static fromMatrix() { return new (globalThis as any).DOMMatrix() }
    static fromFloat32Array() { return new (globalThis as any).DOMMatrix() }
    static fromFloat64Array() { return new (globalThis as any).DOMMatrix() }
    multiply() { return this }
    inverse() { return this }
    translate() { return this }
    scale() { return this }
    rotate() { return this }
    transformPoint(p: { x: number; y: number }) { return p }
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  const buffer = Buffer.from(await file.arrayBuffer())

  if (ext === 'txt') {
    return buffer.toString('utf-8')
  }

  if (ext === 'pdf') {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText({ pageJoiner: '\n\n' })
    return result.text
  }

  if (ext === 'docx') {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  if (ext === 'csv') {
    return buffer.toString('utf-8')
  }

  throw new Error(`Formato de arquivo não suportado: .${ext}`)
}

export function chunkText(text: string, chunkSize = 3000, overlap = 300): string[] {
  if (text.length <= chunkSize) return [text]
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    chunks.push(text.slice(start, end))
    start += chunkSize - overlap
  }
  return chunks
}
