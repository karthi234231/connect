// src/lib/chat/attachment.ts
// S034 — Attachment contract. Path-based (no arbitrary external URLs):
// match-attachments/{matchId}/{uuid}.{ext} in the private `match-attachments` bucket.

export const MATCH_ATTACHMENTS_BUCKET = 'match-attachments'

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024 // 10 MB

export const ALLOWED_ATTACHMENT_MIME = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const

export type AttachmentKind = 'image' | 'file'

export function isImageMime(mime: string): boolean {
  return mime.startsWith('image/')
}

export function attachmentKind(mime: string): AttachmentKind {
  return isImageMime(mime) ? 'image' : 'file'
}

/** Pure validation — safe to call client-side before upload and server-side after. */
export function validateAttachmentFile(file: {
  type: string
  size: number
}): { ok: true } | { ok: false; reason: string } {
  if (file.size <= 0) {
    return { ok: false, reason: 'File is empty.' }
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, reason: 'File exceeds the 10 MB limit.' }
  }
  if (!(ALLOWED_ATTACHMENT_MIME as readonly string[]).includes(file.type)) {
    return { ok: false, reason: 'File type is not allowed.' }
  }
  return { ok: true }
}

/** Extract a safe lowercase extension (alphanumeric only, max 10 chars). */
export function safeExtension(fileName: string): string | null {
  const match = /\.([a-zA-Z0-9]{1,10})$/.exec(fileName)
  return match ? match[1]!.toLowerCase() : null
}

const UUID_RE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

/** Server-trusted path builder. Never derives the matchId from client input. */
export function buildAttachmentPath(matchId: string, fileName: string): string {
  const ext = safeExtension(fileName)
  const suffix = ext ? `.${ext}` : ''
  return `${MATCH_ATTACHMENTS_BUCKET}/${matchId}/${crypto.randomUUID()}${suffix}`
}

export const ATTACHMENT_PATH_PATTERN = new RegExp(
  `^${MATCH_ATTACHMENTS_BUCKET}/${UUID_RE}/${UUID_RE}\\.[a-z0-9]{1,10}$`,
)

/** Strict path validation: bucket + uuid match segment + uuid file name. */
export function isValidAttachmentPath(path: string, matchId: string): boolean {
  if (!ATTACHMENT_PATH_PATTERN.test(path)) return false
  return path.split('/')[1] === matchId
}
