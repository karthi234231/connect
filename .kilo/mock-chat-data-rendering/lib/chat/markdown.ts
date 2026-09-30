export type MessageSegment =
  | { type: 'codeblock'; language: string; code: string }
  | { type: 'inlinecode'; code: string }
  | { type: 'text'; content: string }

const FENCED_CODE = /```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g
const INLINE_CODE = /`([^`\n]+)`/g

/**
 * Parse a chat message into an ordered list of renderable segments:
 * fenced code blocks, inline code, and plain text.
 */
export function parseMarkdownMessage(text: string): MessageSegment[] {
  const segments: MessageSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  FENCED_CODE.lastIndex = 0
  while ((match = FENCED_CODE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      pushText(segments, text.slice(lastIndex, match.index))
    }
    segments.push({
      type: 'codeblock',
      language: (match[1] || 'text').toLowerCase(),
      code: match[2].replace(/\n$/, ''),
    })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    pushText(segments, text.slice(lastIndex))
  }

  return segments.length > 0 ? segments : [{ type: 'text', content: text }]
}

function pushText(segments: MessageSegment[], chunk: string): void {
  let lastIndex = 0
  let match: RegExpExecArray | null
  INLINE_CODE.lastIndex = 0
  while ((match = INLINE_CODE.exec(chunk)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: chunk.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'inlinecode', code: match[1] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < chunk.length) {
    segments.push({ type: 'text', content: chunk.slice(lastIndex) })
  }
}

export type FileCategory =
  | 'image'
  | 'code'
  | 'pdf'
  | 'document'
  | 'archive'
  | 'other'

const EXT_BY_CATEGORY: Record<Exclude<FileCategory, 'other'>, string[]> = {
  image: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'],
  code: ['ts', 'tsx', 'js', 'jsx', 'py', 'rb', 'go', 'rs', 'java', 'json', 'css', 'html', 'sh'],
  pdf: ['pdf'],
  document: ['doc', 'docx', 'txt', 'md', 'rtf', 'pages'],
  archive: ['zip', 'rar', 'tar', 'gz', '7z'],
}

function getExtension(name?: string | null, url?: string | null): string {
  const source = name || url || ''
  const clean = source.split('?')[0].split('#')[0]
  const dot = clean.lastIndexOf('.')
  if (dot === -1) return ''
  return clean.slice(dot + 1).toLowerCase()
}

export function getFileCategory(
  name?: string | null,
  url?: string | null,
): FileCategory {
  const ext = getExtension(name, url)
  for (const [category, exts] of Object.entries(EXT_BY_CATEGORY)) {
    if (exts.includes(ext)) return category as FileCategory
  }
  return 'other'
}

export function getFileExtensionLabel(
  name?: string | null,
  url?: string | null,
): string {
  const ext = getExtension(name, url)
  return ext ? ext.toUpperCase() : 'FILE'
}

/**
 * Detect a fenced code snippet inside a composer draft for the preview chip.
 */
export function extractCodeSnippetDraft(
  draft: string,
): { lang: string; codePreview: string } | null {
  const match = /```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/.exec(draft)
  if (!match) return null
  const code = match[2].trim()
  return {
    lang: (match[1] || 'code').toLowerCase(),
    codePreview: code.length > 40 ? `${code.slice(0, 40)}\u2026` : code || 'snippet',
  }
}
