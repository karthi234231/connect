import { describe, expect, it } from 'vitest'
import {
  extractCodeSnippetDraft,
  getFileCategory,
  getFileExtensionLabel,
  parseMarkdownMessage,
} from '@/lib/chat/markdown'

describe('parseMarkdownMessage', () => {
  it('returns empty array for empty text', () => {
    expect(parseMarkdownMessage('')).toEqual([])
  })

  it('parses simple text', () => {
    expect(parseMarkdownMessage('Hello world')).toEqual([
      { type: 'text', content: 'Hello world' },
    ])
  })

  it('parses inline code inside text', () => {
    expect(parseMarkdownMessage('Run `npm test` now')).toEqual([
      { type: 'text', content: 'Run ' },
      { type: 'inlinecode', code: 'npm test' },
      { type: 'text', content: ' now' },
    ])
  })

  it('parses multi-line code blocks', () => {
    const text = 'Here is the code:\n```ts\nconst x = 42\n```\nAll done!'
    expect(parseMarkdownMessage(text)).toEqual([
      { type: 'text', content: 'Here is the code:\n' },
      { type: 'codeblock', language: 'ts', code: 'const x = 42' },
      { type: 'text', content: '\nAll done!' },
    ])
  })

  it('handles code blocks without explicit language', () => {
    const text = '```\nconsole.log("hi")\n```'
    expect(parseMarkdownMessage(text)).toEqual([
      { type: 'codeblock', language: 'code', code: 'console.log("hi")' },
    ])
  })
})

describe('getFileCategory', () => {
  it('correctly categorizes files by extension', () => {
    expect(getFileCategory('image.png')).toBe('image')
    expect(getFileCategory('script.tsx')).toBe('code')
    expect(getFileCategory('doc.pdf')).toBe('pdf')
    expect(getFileCategory('readme.md')).toBe('document')
    expect(getFileCategory('archive.zip')).toBe('archive')
    expect(getFileCategory('unknown.xyz')).toBe('file')
  })
})

describe('getFileExtensionLabel', () => {
  it('returns uppercase extension', () => {
    expect(getFileExtensionLabel('app.tsx')).toBe('TSX')
    expect(getFileExtensionLabel('document.pdf')).toBe('PDF')
    expect(getFileExtensionLabel('noext')).toBe('FILE')
  })
})

describe('extractCodeSnippetDraft', () => {
  it('extracts snippet info from draft containing code blocks', () => {
    const draft = '```ts\nfunction hello() {\n  return 1\n}\n```'
    expect(extractCodeSnippetDraft(draft)).toEqual({
      lang: 'ts',
      codePreview: 'function hello() {',
    })
  })

  it('returns null if draft has no code block', () => {
    expect(extractCodeSnippetDraft('hello world')).toBeNull()
  })
})
