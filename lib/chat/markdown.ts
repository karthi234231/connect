// src/lib/chat/markdown.ts
// Pure helper functions for parsing markdown code blocks, inline code,
// auto-linking plain-text URLs/emails, and classifying file attachments.

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
 * A parsed plain-text substring that may contain auto-linked URLs/emails.
 * `linkifyMessageText` is applied to `MessageSegment` text blocks AFTER
 * markdown parsing so backtick code/inline-code spans are never linked.
 */
export type LinkifiedSegment =
  | { type: 'text'; content: string }
  | { type: 'link'; text: string; href: string }

const FENCE = '```'
/** A language/info token: identifiers plus `+`/`-` (e.g. `tsx`, `c++`, `docker-compose`). */
const LANG_TOKEN = /^[a-zA-Z0-9_+\-]+/
/** Opening fences are only unclosed-safe at the start of a line (up to 3 spaces indent). */
const OPEN_INDENT = /^ {0,3}$/

/** Normalizes CRLF and lone-CR line endings to LF before parsing. */
function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n?/g, '\n')
}

interface FenceBlock {
  lang: string
  code: string
  /** Index right after the consumed block (closing fence line or EOF). */
  end: number
}

/** Finds the first ```` ``` ```` inside a fence header whose rest-of-line is whitespace. */
function findInlineCloser(header: string): number {
  let search = 0
  while (search < header.length) {
    const idx = header.indexOf(FENCE, search)
    if (idx === -1) return -1
    if (/^[ \t]*$/.test(header.slice(idx + FENCE.length))) return idx
    search = idx + FENCE.length
  }
  return -1
}

/**
 * Attempts to parse a fenced code block starting at `openIdx` (a ```` ``` ````
 * occurrence). Returns `null` when the candidate is not actually a fence, in
 * which case the caller should keep scanning past `openIdx`.
 */
function tryMatchFence(text: string, openIdx: number): FenceBlock | null {
  const lineStart = text.lastIndexOf('\n', openIdx - 1) + 1
  const atLineStart = OPEN_INDENT.test(text.slice(lineStart, openIdx))

  const lineEnd = text.indexOf('\n', openIdx + FENCE.length)
  const header = text.slice(
    openIdx + FENCE.length,
    lineEnd === -1 ? text.length : lineEnd,
  )

  // A closing fence on the opening line: "```ts```", "``` code ```", "``` ```".
  const inlineClose = findInlineCloser(header)
  if (inlineClose !== -1) {
    const mid = header.slice(0, inlineClose).trim()
    let lang = ''
    let code = ''
    if (mid !== '') {
      const m = LANG_TOKEN.exec(mid)
      if (!m) return null
      lang = m[0]
      code = mid.slice(lang.length).trim()
    }
    return {
      lang: (lang || 'code').toLowerCase(),
      code,
      end: lineEnd === -1 ? text.length : lineEnd + 1,
    }
  }

  const info = header.trim()
  let lang = ''
  if (info !== '') {
    const m = LANG_TOKEN.exec(info)
    if (!m) return null
    lang = m[0]
  }

  const contentStart = lineEnd === -1 ? text.length : lineEnd + 1
  const closeIdx = text.indexOf(FENCE, contentStart)

  if (closeIdx !== -1) {
    return {
      lang: (lang || 'code').toLowerCase(),
      code: text.slice(contentStart, closeIdx).replace(/\n$/, ''),
      end: closeIdx + FENCE.length,
    }
  }

  if (atLineStart) {
    // An unclosed fence at the start of a line consumes the rest of the buffer.
    return {
      lang: (lang || 'code').toLowerCase(),
      code: text.slice(contentStart).replace(/\n$/, ''),
      end: text.length,
    }
  }

  return null
}

/**
 * Parses raw chat message text into structured segments (plain text, inline code,
 * and multi-line markdown code blocks). Handles CRLF input, empty blocks,
 * same-line fences, and unclosed fences.
 */
export function parseMarkdownMessage(text: string): MessageSegment[] {
  if (!text) return []

  const source = normalizeLineEndings(text)
  const segments: MessageSegment[] = []
  let lastIndex = 0
  let scan = 0

  while (scan < source.length) {
    const openIdx = source.indexOf(FENCE, scan)
    if (openIdx === -1) break

    const block = tryMatchFence(source, openIdx)
    if (!block) {
      scan = openIdx + FENCE.length
      continue
    }

    if (openIdx > lastIndex) {
      parseInlineCode(source.slice(lastIndex, openIdx), segments)
    }
    segments.push({
      type: 'codeblock',
      language: block.lang,
      code: block.code,
    })
    lastIndex = block.end
    scan = block.end
  }

  if (lastIndex < source.length) {
    parseInlineCode(source.slice(lastIndex), segments)
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

const CATEGORY_EXTENSIONS: Record<
  Exclude<FileCategory, 'file'>,
  readonly string[]
> = {
  image: [
    'jpg',
    'jpeg',
    'png',
    'webp',
    'gif',
    'svg',
    'avif',
    'heic',
    'heif',
    'bmp',
    'ico',
    'tif',
    'tiff',
  ],
  code: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'cjs',
    'mjs',
    'json',
    'py',
    'css',
    'html',
    'htm',
    'sql',
    'sh',
    'bash',
    'cpp',
    'cc',
    'cxx',
    'c',
    'h',
    'hpp',
    'rs',
    'go',
    'java',
    'kt',
    'kts',
    'rb',
    'php',
    'swift',
    'yaml',
    'yml',
    'toml',
    'xml',
    'ini',
    'env',
    'vue',
    'svelte',
  ],
  pdf: ['pdf'],
  document: [
    'doc',
    'docx',
    'txt',
    'rtf',
    'md',
    'mdx',
    'csv',
    'pages',
    'xls',
    'xlsx',
    'ppt',
    'pptx',
    'odt',
    'ods',
    'odp',
    'tex',
  ],
  archive: ['zip', 'tar', 'gz', 'tgz', 'rar', '7z', 'bz2', 'xz', 'zst', 'dmg', 'iso'],
}

/** Extracts a lowercase extension, ignoring query strings/hashes and multi-dot filenames. */
function extractExtension(filename?: string | null, url?: string | null): string {
  const source = (filename || url || '').split('?')[0].split('#')[0]
  const dot = source.lastIndexOf('.')
  if (dot === -1 || dot === source.length - 1) return ''
  return source.slice(dot + 1).toLowerCase()
}

/** Categorizes file attachments by extension or MIME type hint. */
export function getFileCategory(
  filename?: string | null,
  url?: string | null,
): FileCategory {
  const ext = extractExtension(filename, url)
  for (const [category, exts] of Object.entries(CATEGORY_EXTENSIONS)) {
    if ((exts as readonly string[]).includes(ext)) return category as FileCategory
  }
  return 'file'
}

/** Formats a uppercase short label for extension badges. */
export function getFileExtensionLabel(
  filename?: string | null,
  url?: string | null,
): string {
  const ext = extractExtension(filename, url)
  return ext ? ext.toUpperCase() : 'FILE'
}

/** Extracts markdown code block preview info from a composer draft. */
export function extractCodeSnippetDraft(
  text: string,
): { lang: string; codePreview: string } | null {
  if (!text) return null

  const source = normalizeLineEndings(text)
  let scan = 0

  while (scan < source.length) {
    const openIdx = source.indexOf(FENCE, scan)
    if (openIdx === -1) return null

    const block = tryMatchFence(source, openIdx)
    if (!block) {
      scan = openIdx + FENCE.length
      continue
    }

    const codeContent = block.code.trim()
    const firstLine = codeContent.split('\n')[0] ?? ''

    return {
      lang: block.lang,
      codePreview:
        firstLine.length > 30 ? `${firstLine.slice(0, 30)}…` : firstLine || 'Snippet',
    }
  }

  return null
}

/** Auto-linked matches longer than this stay plain text. */
const MAX_LINKIFY_LENGTH = 2048

const LINKIFY_RE =
  /(?:https?:\/\/[^\s<>"'`]+)|(?:mailto:[^\s<>"'`]+)|(?:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+)/g

const EMAIL_LOCAL = /^[a-zA-Z0-9._%+-]+$/
const EMAIL_LABEL = /^[a-zA-Z0-9-]+$/

/** Validates that a candidate email has exactly one `@`, a dotted domain, and sane labels. */
function isPlausibleEmail(value: string): boolean {
  const at = value.indexOf('@')
  if (at <= 0 || value.indexOf('@', at + 1) !== -1) return false
  const local = value.slice(0, at)
  const domain = value.slice(at + 1)
  if (!EMAIL_LOCAL.test(local)) return false
  if (
    !domain.includes('.') ||
    domain.startsWith('.') ||
    domain.endsWith('.') ||
    domain.startsWith('-') ||
    domain.endsWith('-') ||
    domain.includes('..')
  ) {
    return false
  }
  return domain.split('.').every((label) => EMAIL_LABEL.test(label))
}

/** Strips trailing sentence punctuation so it stays outside the link. */
function stripTrailingLinkPunctuation(value: string): string {
  let end = value.length
  while (end > 0) {
    const char = value[end - 1]!
    if (",.;:!?'".includes(char) || char === '"') {
      end -= 1
      continue
    }
    if (char === ')' || char === ']' || char === '}') {
      const opener = char === ')' ? '(' : char === ']' ? '[' : '{'
      let opens = 0
      let closes = 0
      for (let i = 0; i < end; i += 1) {
        if (value[i] === opener) opens += 1
        if (value[i] === char) closes += 1
      }
      if (closes > opens) {
        end -= 1
        continue
      }
    }
    break
  }
  return value.slice(0, end)
}

/**
 * Splits plain markdown text into text and auto-linked segments for
 * `https?://` URLs and email addresses (bare emails produce `mailto:` hrefs;
 * literal `mailto:` strings pass through). Never emits anything but http(s)/
 * mailto hrefs (so `javascript:` can never appear), respects a maximum URL
 * length, and never touches content adjacent to a stray backtick. Call this on
 * `MessageSegment` text blocks AFTER `parseMarkdownMessage`, never on raw
 * unfenced text, so code and inline-code spans are never linked.
 */
export function linkifyMessageText(text: string): LinkifiedSegment[] {
  if (!text) return []

  const parts: LinkifiedSegment[] = []
  let lastIndex = 0

  for (const match of text.matchAll(LINKIFY_RE)) {
    const raw = match[0]
    const matchIndex = match.index ?? 0

    if (text[matchIndex - 1] === '`' || text[matchIndex + raw.length] === '`') {
      continue
    }

    if (matchIndex > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, matchIndex) })
    }

    const candidate = stripTrailingLinkPunctuation(raw)
    const isUrl = /^https?:\/\//.test(raw)
    const isMailto = raw.startsWith('mailto:')
    let href = ''
    let display = ''

    if (isUrl) {
      const schemeLength = raw.startsWith('https://') ? 8 : 7
      if (candidate.length > schemeLength) {
        href = candidate
        display = candidate
      }
    } else if (isMailto) {
      if (candidate.length > 'mailto:'.length) {
        href = candidate
        display = candidate
      }
    } else if (candidate.includes('@') && isPlausibleEmail(candidate)) {
      href = `mailto:${candidate}`
      display = candidate
    }

    if (href && href.length <= MAX_LINKIFY_LENGTH) {
      parts.push({ type: 'link', text: display, href })
      lastIndex = matchIndex + candidate.length
    } else {
      parts.push({ type: 'text', content: raw })
      lastIndex = matchIndex + raw.length
    }
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) })
  }

  return parts
}