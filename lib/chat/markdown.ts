// src/lib/chat/markdown.ts
// Pure helper functions for parsing markdown code blocks, inline code,
// and classifying file attachments in chat messages.

export type MessageSegment =
  | { type: 'text'; content: string }
  | { type: 'codeblock'; language: string; code: string }
  | { type: 'inlinecode'; code: string }

export type FileCategory =
  | 'image'
  | 'code'
  | 'pdf'
  | 'document'
  | 'archive'
  | 'file'

/**
 * Parses raw chat message text into structured segments (plain text, inline code,
 * and multi-line markdown code blocks).
 */
export function parseMarkdownMessage(text: string): MessageSegment[] {
  if (!text) return []

  const segments: MessageSegment[] = []
  // Matches ```[language]\n[code]```
  const codeBlockRegex = /```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const matchIndex = match.index

    if (matchIndex > lastIndex) {
      const textBefore = text.slice(lastIndex, matchIndex)
      parseInlineCode(textBefore, segments)
    }

    const rawLang = match[1]?.trim() || ''
    const code = match[2] ?? ''

    segments.push({
      type: 'codeblock',
      language: rawLang || 'code',
      code: code.replace(/\n$/, ''),
    })

    lastIndex = codeBlockRegex.lastIndex
  }

  if (lastIndex < text.length) {
    const textAfter = text.slice(lastIndex)
    parseInlineCode(textAfter, segments)
  }

  return segments
}

function parseInlineCode(text: string, segments: MessageSegment[]) {
  const inlineRegex = /`([^`\n]+)`/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = inlineRegex.exec(text)) !== null) {
    const matchIndex = match.index
    if (matchIndex > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, matchIndex),
      })
    }
    segments.push({
      type: 'inlinecode',
      code: match[1] ?? '',
    })
    lastIndex = inlineRegex.lastIndex
  }

  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    })
  }
}

/** Categorizes file attachments by extension or MIME type hint. */
export function getFileCategory(
  filename?: string | null,
  url?: string | null,
): FileCategory {
  const target = (filename || url || '')
    .split('?')[0]
    .split('#')[0]
    .toLowerCase()
  const ext = target.includes('.') ? target.split('.').pop()! : ''

  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) {
    return 'image'
  }
  if (
    [
      'ts',
      'tsx',
      'js',
      'jsx',
      'json',
      'py',
      'css',
      'html',
      'sql',
      'sh',
      'cpp',
      'rs',
      'go',
      'java',
      'c',
      'h',
      'yaml',
      'yml',
    ].includes(ext)
  ) {
    return 'code'
  }
  if (ext === 'pdf') {
    return 'pdf'
  }
  if (['doc', 'docx', 'txt', 'rtf', 'md', 'csv', 'pages'].includes(ext)) {
    return 'document'
  }
  if (['zip', 'tar', 'gz', 'rar', '7z', 'bz2'].includes(ext)) {
    return 'archive'
  }
  return 'file'
}

/** Formats a uppercase short label for extension badges. */
export function getFileExtensionLabel(
  filename?: string | null,
  url?: string | null,
): string {
  const target = (filename || url || '')
    .split('?')[0]
    .split('#')[0]
    .toLowerCase()
  const ext = target.includes('.') ? target.split('.').pop()! : ''
  return ext ? ext.toUpperCase() : 'FILE'
}

/** Extracts markdown code block preview info from a composer draft. */
export function extractCodeSnippetDraft(
  text: string,
): { lang: string; codePreview: string } | null {
  const codeBlockMatch = /```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/.exec(text)
  if (!codeBlockMatch) return null

  const rawLang = codeBlockMatch[1]?.trim() || ''
  const codeContent = codeBlockMatch[2]?.trim() || ''
  const firstLine = codeContent.split('\n')[0] ?? ''

  return {
    lang: rawLang || 'code',
    codePreview:
      firstLine.length > 30 ? `${firstLine.slice(0, 30)}…` : firstLine || 'Snippet',
  }
}
