// tests/units/chat-attachment.test.ts
// S034 attachment contract — path shape, upload validation, and the display
// helpers (isImageAttachmentUrl / formatFileSize) used by the composer preview,
// message bubble and file chips. Guards the round-trip invariant: every path
// `buildAttachmentPath` mints MUST pass `isValidAttachmentPath` (a broken
// upload previously could not be sent at all when the file had no extension).
import { describe, expect, it } from 'vitest'
import {
  ALLOWED_ATTACHMENT_MIME,
  attachmentKind,
  ATTACHMENT_PATH_PATTERN,
  buildAttachmentPath,
  formatFileSize,
  isImageAttachmentUrl,
  isImageMime,
  isValidAttachmentPath,
  MATCH_ATTACHMENTS_BUCKET,
  MAX_ATTACHMENT_BYTES,
  safeExtension,
  validateAttachmentFile,
} from '@/lib/chat/attachment'

const MATCH_UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const FILE_UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3302'

const scopedPath = (fileName: string, ext?: string) =>
  `match-attachments/${MATCH_UUID}/${FILE_UUID}${ext ? `.${ext}` : ''}`

describe('attachment contract constants', () => {
  it('pins the private bucket name', () => {
    expect(MATCH_ATTACHMENTS_BUCKET).toBe('match-attachments')
  })

  it('keeps the upload cap at exactly 10 MB (binary)', () => {
    expect(MAX_ATTACHMENT_BYTES).toBe(10 * 1024 * 1024)
  })

  it('allowlists image, pdf, text and word document types', () => {
    expect(ALLOWED_ATTACHMENT_MIME).toEqual([
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ])
  })
})

describe('isImageMime / attachmentKind', () => {
  it('classifies any image/* mime as an image attachment', () => {
    expect(isImageMime('image/png')).toBe(true)
    expect(isImageMime('image/jpeg')).toBe(true)
    expect(attachmentKind('image/webp')).toBe('image')
  })

  it('classifies everything else as a plain file', () => {
    expect(isImageMime('application/pdf')).toBe(false)
    expect(attachmentKind('text/plain')).toBe('file')
    expect(attachmentKind('application/pdf')).toBe('file')
  })
})

describe('validateAttachmentFile', () => {
  it('accepts an allowed type within the 10 MB cap', () => {
    expect(
      validateAttachmentFile({ type: 'image/png', size: 1024 }).ok,
    ).toBe(true)
  })

  it('accepts the exact 10 MB boundary (inclusive)', () => {
    expect(
      validateAttachmentFile({ type: 'text/plain', size: MAX_ATTACHMENT_BYTES })
        .ok,
    ).toBe(true)
  })

  it('rejects empty and negative sizes', () => {
    expect(validateAttachmentFile({ type: 'text/plain', size: 0 })).toEqual({
      ok: false,
      reason: 'File is empty.',
    })
    expect(validateAttachmentFile({ type: 'text/plain', size: -5 })).toEqual({
      ok: false,
      reason: 'File is empty.',
    })
  })

  it('rejects anything over 10 MB', () => {
    expect(
      validateAttachmentFile({
        type: 'text/plain',
        size: MAX_ATTACHMENT_BYTES + 1,
      }),
    ).toEqual({ ok: false, reason: 'File exceeds the 10 MB limit.' })
  })

  it('rejects types outside the MIME allowlist', () => {
    expect(
      validateAttachmentFile({
        type: 'application/x-msdownload',
        size: 100,
      }),
    ).toEqual({ ok: false, reason: 'File type is not allowed.' })
    expect(
      validateAttachmentFile({ type: 'image/svg+xml', size: 100 }).ok,
    ).toBe(false)
  })
})

describe('safeExtension', () => {
  it.each([
    ['photo.jpg', 'jpg'],
    ['PHOTO.JPEG', 'jpeg'],
    ['archive.tar.gz', 'gz'],
    ['weird#name.WebP', 'webp'],
    ['file with spaces.txt', 'txt'],
    ['file.with.multiple.dots', 'dots'],
    ['x.ABCDEFGHIJ', 'abcdefghij'],
  ])('extracts %s as %s', (fileName, expected) => {
    expect(safeExtension(fileName)).toBe(expected)
  })

  it.each([
    ['noext', ''],
    ['photo.', ''],
    ['..', ''],
    ['', ''],
  ])('returns null when %s has no usable extension', (fileName) => {
    expect(safeExtension(fileName)).toBeNull()
  })

  it('rejects extensions longer than 10 chars', () => {
    expect(safeExtension('x.abcdefghijk')).toBeNull()
  })
})

describe('buildAttachmentPath', () => {
  it('mints a bucket + uuid match + uuid file path', () => {
    const path = buildAttachmentPath(MATCH_UUID, 'resume.pdf')
    const segments = path.split('/')
    expect(segments[0]).toBe(MATCH_ATTACHMENTS_BUCKET)
    expect(segments[1]).toBe(MATCH_UUID)
    expect(path).toMatch(ATTACHMENT_PATH_PATTERN)
    expect(isValidAttachmentPath(path, MATCH_UUID)).toBe(true)
  })

  it('lowercases the extension onto the minted file name', () => {
    const path = buildAttachmentPath(MATCH_UUID, 'HELLO.PNG')
    expect(path.endsWith('.png')).toBe(true)
    expect(isValidAttachmentPath(path, MATCH_UUID)).toBe(true)
  })

  it('keeps a 10-char extension and drops an 11-char one', () => {
    expect(
      isValidAttachmentPath(
        buildAttachmentPath(MATCH_UUID, 'x.abcdefghij'),
        MATCH_UUID,
      ),
    ).toBe(true)
    expect(
      buildAttachmentPath(MATCH_UUID, 'x.abcdefghijk').endsWith('.abcdefghijk'),
    ).toBe(false)
  })

  it('round-trips an extensionless file name through the validator', () => {
    const path = buildAttachmentPath(MATCH_UUID, 'README')
    expect(path.endsWith('.README')).toBe(false)
    expect(path).toMatch(ATTACHMENT_PATH_PATTERN)
    expect(isValidAttachmentPath(path, MATCH_UUID)).toBe(true)
  })

  it('mints a fresh uuid per call', () => {
    const a = buildAttachmentPath(MATCH_UUID, 'a.pdf')
    const b = buildAttachmentPath(MATCH_UUID, 'b.pdf')
    expect(a).not.toBe(b)
  })
})

describe('ATTACHMENT_PATH_PATTERN', () => {
  it.each(['pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'txt', 'abcdefghij'])(
    'accepts a valid path with .%s',
    (ext) => {
      expect(ATTACHMENT_PATH_PATTERN.test(scopedPath('any', ext))).toBe(true)
    },
  )

  it('accepts an extensionless path (buildAttachmentPath parity)', () => {
    expect(ATTACHMENT_PATH_PATTERN.test(scopedPath('README'))).toBe(true)
  })

  it.each([
    ['wrong bucket', 'other-bucket/abc/def.png'],
    ['missing bucket', FILE_UUID + '.png'],
    ['non-uuid match segment', `match-attachments/not-a-uuid/${FILE_UUID}.png`],
    ['non-uuid file segment', `match-attachments/${MATCH_UUID}/not-a-uuid.png`],
    ['uppercase extension', scopedPath('x', 'PNG')],
    [
      'uppercase uuid hex',
      'match-attachments/3F2504E0-4F89-41D3-9A0C-0305E82C3301/3f2504e0-4f89-41d3-9a0c-0305e82c3302.png',
    ],
    ['traversal after ext', scopedPath('x', 'png/../evil')],
    ['query string', `${scopedPath('x', 'png')}?token=abc`],
    ['hash fragment', `${scopedPath('x', 'png')}#frag`],
    ['11-char extension', scopedPath('x', 'abcdefghijk')],
    ['double extension', `match-attachments/${MATCH_UUID}/${FILE_UUID}.txt.exe`],
    ['extra slash segment', `match-attachments/${MATCH_UUID}/${FILE_UUID}/extra`],
  ])('rejects %s', (_label, path) => {
    expect(ATTACHMENT_PATH_PATTERN.test(path)).toBe(false)
  })
})

describe('isValidAttachmentPath', () => {
  it('accepts a path minted for the given match', () => {
    expect(isValidAttachmentPath(scopedPath('photo', 'jpg'), MATCH_UUID)).toBe(
      true,
    )
  })

  it('rejects a path whose match segment differs', () => {
    expect(
      isValidAttachmentPath(scopedPath('photo', 'jpg'), MATCH_UUID),
    ).toBe(true)
    expect(
      isValidAttachmentPath(scopedPath('photo', 'jpg'), '9f2504e0-4f89-41d3-9a0c-0305e82c3309'),
    ).toBe(false)
  })

  it('accepts an extensionless path for the given match', () => {
    expect(isValidAttachmentPath(scopedPath('README'), MATCH_UUID)).toBe(true)
  })

  it('rejects non-canonical shapes even with a matching segment', () => {
    expect(
      isValidAttachmentPath('https://evil.example/photo.jpg', MATCH_UUID),
    ).toBe(false)
    expect(
      isValidAttachmentPath(`avatars/${MATCH_UUID}/${FILE_UUID}.png`, MATCH_UUID),
    ).toBe(false)
  })
})

describe('isImageAttachmentUrl', () => {
  it('returns false for nullish and empty values', () => {
    expect(isImageAttachmentUrl(null)).toBe(false)
    expect(isImageAttachmentUrl(undefined)).toBe(false)
    expect(isImageAttachmentUrl('')).toBe(false)
  })

  it.each(['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'])(
    'treats a .%s extension as an image',
    (ext) => {
      expect(isImageAttachmentUrl(scopedPath('photo', ext))).toBe(true)
    },
  )

  it('detects other file types as non-images', () => {
    expect(isImageAttachmentUrl(scopedPath('doc', 'pdf'))).toBe(false)
    expect(isImageAttachmentUrl(scopedPath('notes', 'txt'))).toBe(false)
    expect(isImageAttachmentUrl(scopedPath('doc', 'docx'))).toBe(false)
  })

  it('matches case-insensitively (composer/bubble parity)', () => {
    expect(isImageAttachmentUrl(scopedPath('PHOTO', 'PNG'))).toBe(true)
    expect(isImageAttachmentUrl('IMG_123.JPEG')).toBe(true)
  })

  it('keeps a signed URL whose query string follows the extension', () => {
    expect(
      isImageAttachmentUrl(
        `${scopedPath('photo', 'png')}?token=abc&expires=1737500000`,
      ),
    ).toBe(true)
    expect(isImageAttachmentUrl(`${scopedPath('photo', 'png')}#frag`)).toBe(true)
  })

  it('strips the extension only at the end (no mid-string matches)', () => {
    expect(isImageAttachmentUrl('photo.png.backup')).toBe(false)
  })

  it('detects inline data:image URLs', () => {
    expect(isImageAttachmentUrl('data:image/png;base64,iVBORw0==')).toBe(true)
    expect(isImageAttachmentUrl('data:image/svg+xml,<svg></svg>')).toBe(true)
  })

  it('does not treat non-image data URLs as images', () => {
    expect(isImageAttachmentUrl('data:application/pdf;base64,JVBERi0=')).toBe(
      false,
    )
  })
})

describe('formatFileSize', () => {
  it.each([
    [0, '0 B'],
    [1, '1 B'],
    [512, '512 B'],
    [1023, '1023 B'],
    [1024, '1.0 KB'],
    [1536, '1.5 KB'],
    [19456, '19.0 KB'],
    [1048576, '1.0 MB'],
    [1572864, '1.5 MB'],
    [MAX_ATTACHMENT_BYTES, '10.0 MB'],
  ])('formats %i bytes as %s', (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected)
  })

  it('clamps negative and non-finite inputs to 0 B', () => {
    expect(formatFileSize(-5)).toBe('0 B')
    expect(formatFileSize(Number.NaN)).toBe('0 B')
    expect(formatFileSize(Number.POSITIVE_INFINITY)).toBe('0 B')
  })
})