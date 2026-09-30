import { describe, expect, it } from 'vitest'
import { ALLOWED_ATTACHMENT_MIME } from '@/lib/chat/attachment'
import {
  extractCodeSnippetDraft,
  getFileCategory,
  getFileExtensionLabel,
  linkifyMessageText,
  parseMarkdownMessage,
  type FileCategory,
} from '@/lib/chat/markdown'

describe('parseMarkdownMessage edge cases', () => {
  it('keeps returning an empty array for empty text', () => {
    expect(parseMarkdownMessage('')).toEqual([])
  })

  it('consumes an unclosed fence at the start of a line to EOF', () => {
    expect(parseMarkdownMessage('Before\n```ts\nconst x = 1')).toEqual([
      { type: 'text', content: 'Before\n' },
      { type: 'codeblock', language: 'ts', code: 'const x = 1' },
    ])
  })

  it('leaves a mid-line unclosed fence as plain text', () => {
    expect(parseMarkdownMessage('Use ```ts\ncode')).toEqual([
      { type: 'text', content: 'Use ```ts\ncode' },
    ])
  })

  it('still parses a mid-line fence that has a closing fence (legacy behavior)', () => {
    expect(parseMarkdownMessage('Use ```ts\ncode\n```')).toEqual([
      { type: 'text', content: 'Use ' },
      { type: 'codeblock', language: 'ts', code: 'code' },
    ])
  })

  it('keeps triple backticks in prose as literal text', () => {
    expect(parseMarkdownMessage('Triple ``` are fine here.')).toEqual([
      { type: 'text', content: 'Triple ``` are fine here.' },
    ])
  })

  it('normalizes CRLF line endings', () => {
    expect(
      parseMarkdownMessage('Line one\r\n```ts\r\nconst x = 1\r\n```\r\nLine two'),
    ).toEqual([
      { type: 'text', content: 'Line one\n' },
      { type: 'codeblock', language: 'ts', code: 'const x = 1' },
      { type: 'text', content: '\nLine two' },
    ])
  })

  it('supports language tags with dashes, plus signs, and case normalization', () => {
    expect(parseMarkdownMessage('```TSX\n<a/>\n```')[0]).toMatchObject({
      language: 'tsx',
    })
    expect(parseMarkdownMessage('```docker-compose\nservices:\n```')[0]).toMatchObject({
      language: 'docker-compose',
    })
    expect(parseMarkdownMessage('```c++\nint x;\n```')[0]).toMatchObject({
      language: 'c++',
    })
  })

  it('parses empty one-line code blocks with and without a language tag', () => {
    expect(parseMarkdownMessage('``` ```')).toEqual([
      { type: 'codeblock', language: 'code', code: '' },
    ])
    expect(parseMarkdownMessage('```ts```')).toEqual([
      { type: 'codeblock', language: 'ts', code: '' },
    ])
  })

  it('parses a code block whose content is only blank lines', () => {
    expect(parseMarkdownMessage('```\n\n```')).toEqual([
      { type: 'codeblock', language: 'code', code: '' },
    ])
  })

  it('keeps internal blank lines but strips the fence-adjacent trailing newline', () => {
    expect(parseMarkdownMessage('```\nline1\n\nline3\n```')).toEqual([
      { type: 'codeblock', language: 'code', code: 'line1\n\nline3' },
    ])
  })

  it('mixes inline code with code blocks', () => {
    expect(parseMarkdownMessage('`a` and\n```js\nconst b = confirm()\n```')).toEqual([
      { type: 'inlinecode', code: 'a' },
      { type: 'text', content: ' and\n' },
      { type: 'codeblock', language: 'js', code: 'const b = confirm()' },
    ])
  })
})

describe('linkifyMessageText', () => {
  it('returns a single text part when nothing matches', () => {
    expect(linkifyMessageText('no links here')).toEqual([
      { type: 'text', content: 'no links here' },
    ])
    expect(linkifyMessageText('')).toEqual([])
  })

  it('links https and http URLs inside text', () => {
    expect(linkifyMessageText('See https://example.com now')).toEqual([
      { type: 'text', content: 'See ' },
      { type: 'link', text: 'https://example.com', href: 'https://example.com' },
      { type: 'text', content: ' now' },
    ])
    expect(linkifyMessageText('go http://example.com')).toEqual([
      { type: 'text', content: 'go ' },
      { type: 'link', text: 'http://example.com', href: 'http://example.com' },
    ])
  })

  it('keeps trailing sentence punctuation outside the link', () => {
    expect(linkifyMessageText('Go to https://example.com/path, ok?')).toEqual([
      { type: 'text', content: 'Go to ' },
      {
        type: 'link',
        text: 'https://example.com/path',
        href: 'https://example.com/path',
      },
      { type: 'text', content: ', ok?' },
    ])
  })

  it('keeps balanced parentheses in URLs', () => {
    expect(
      linkifyMessageText('https://en.wikipedia.org/wiki/Foo_(bar)'),
    ).toEqual([
      {
        type: 'link',
        text: 'https://en.wikipedia.org/wiki/Foo_(bar)',
        href: 'https://en.wikipedia.org/wiki/Foo_(bar)',
      },
    ])
  })

  it('links bare email addresses via mailto hrefs', () => {
    expect(linkifyMessageText('mail peter@example.com now')).toEqual([
      { type: 'text', content: 'mail ' },
      {
        type: 'link',
        text: 'peter@example.com',
        href: 'mailto:peter@example.com',
      },
      { type: 'text', content: ' now' },
    ])
  })

  it('passes explicit mailto: strings through as links', () => {
    expect(linkifyMessageText('Write to mailto:support@example.com')).toEqual([
      { type: 'text', content: 'Write to ' },
      {
        type: 'link',
        text: 'mailto:support@example.com',
        href: 'mailto:support@example.com',
      },
    ])
  })

  it('never links non-http schemes, especially javascript:', () => {
    expect(linkifyMessageText('ftp://host/x and javascript:alert(1)')).toEqual([
      { type: 'text', content: 'ftp://host/x and javascript:alert(1)' },
    ])
  })

  it('leaves degenerate scheme-only tokens as plain text', () => {
    expect(linkifyMessageText('see https:// here')).toEqual([
      { type: 'text', content: 'see https:// here' },
    ])
  })

  it('does not link matches adjacent to a backtick', () => {
    expect(linkifyMessageText('`https://example.com')).toEqual([
      { type: 'text', content: '`https://example.com' },
    ])
  })

  it('leaves over-long URLs as plain text', () => {
    const longUrl = `https://example.com/${'a'.repeat(3000)}`
    expect(linkifyMessageText(longUrl)).toEqual([
      { type: 'text', content: longUrl },
    ])
  })
})

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
}

describe('getFileCategory', () => {
  it('covers every extension in the allowlisted attachment MIME set', () => {
    for (const mime of ALLOWED_ATTACHMENT_MIME) {
      const ext = MIME_TO_EXT[mime]
      expect(ext, `missing extension mapping for ${mime}`).toBeTruthy()
      expect(getFileCategory(`file.${ext}`), `unclassified ${mime}`).not.toBe(
        'file',
      )
    }
  })

  it('categorizes broad file-type lists', () => {
    const expected: Array<[string, FileCategory]> = [
      ['photo.avif', 'image'],
      ['app.tsx', 'code'],
      ['main.rb', 'code'],
      ['compose.yaml', 'code'],
      ['doc.pdf', 'pdf'],
      ['readme.md', 'document'],
      ['sheet.xlsx', 'document'],
      ['notes.txt', 'document'],
      ['archive.tar.gz', 'archive'],
      ['archive.tgz', 'archive'],
      ['unknown.xyz', 'file'],
    ]
    for (const [name, category] of expected) {
      expect(getFileCategory(name), name).toBe(category)
    }
  })

  it('ignores query strings and hashes when classifying URLs', () => {
    expect(
      getFileCategory('', 'https://cdn.example.com/files/report.pdf?token=abc'),
    ).toBe('pdf')
    expect(
      getFileExtensionLabel(
        '',
        'https://cdn.example.com/files/report.pdf?token=abc',
      ),
    ).toBe('PDF')
  })
})

describe('getFileExtensionLabel', () => {
  it('returns the uppercase extension or FILE fallback', () => {
    expect(getFileExtensionLabel('app.tsx')).toBe('TSX')
    expect(getFileExtensionLabel('document.pdf')).toBe('PDF')
    expect(getFileExtensionLabel('readme.md')).toBe('MD')
    expect(getFileExtensionLabel('noext')).toBe('FILE')
  })
})

describe('extractCodeSnippetDraft', () => {
  it('extracts the language and a first-line preview', () => {
    expect(
      extractCodeSnippetDraft('```ts\nfunction hello() {\n  return 1\n}\n```'),
    ).toEqual({
      lang: 'ts',
      codePreview: 'function hello() {',
    })
  })

  it('handles CRLF drafts and normalizes language case', () => {
    expect(extractCodeSnippetDraft('```GO\r\npackage main\r\n```')).toEqual({
      lang: 'go',
      codePreview: 'package main',
    })
  })

  it('previews an unclosed draft fence', () => {
    expect(extractCodeSnippetDraft('```ts\nwork in progress')).toEqual({
      lang: 'ts',
      codePreview: 'work in progress',
    })
  })

  it('returns null when there is no fenced block', () => {
    expect(extractCodeSnippetDraft('hello world')).toBeNull()
    expect(extractCodeSnippetDraft('')).toBeNull()
  })
})