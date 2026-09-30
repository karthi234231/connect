// src/lib/chat/attachment.ts
// S034 — Attachment contract. Path-based (no arbitrary external URLs):
// match-attachments/{matchId}/{uuid}[.{ext}] in the private
// `match-attachments` bucket. The extension is OPTIONAL: buildAttachmentPath
// must mint only paths that isValidAttachmentPath accepts, and a legitimately
// uploaded extensionless file (e.g. `README`) would otherwise mint a path the
// send-time validator rejects with a misleading "does not belong" error.

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

// The extension group is optional so every path buildAttachmentPath can mint
// (including extensionless names) round-trips through isValidAttachmentPath.
// The security spine is bucket + uuid match segment + uuid file segment; the
// extension only drives display classification and adds no access control.
export const ATTACHMENT_PATH_PATTERN = new RegExp(
  `^${MATCH_ATTACHMENTS_BUCKET}/${UUID_RE}/${UUID_RE}(?:\\.[a-z0-9]{1,10})?$`,
)

/** Strict path validation: bucket + uuid match segment + uuid file name. */
export function isValidAttachmentPath(path: string, matchId: string): boolean {
  if (!ATTACHMENT_PATH_PATTERN.test(path)) return false
  return path.split('/')[1] === matchId
}

// ─── Additive display helpers (composer preview, message bubble, file chips) ─

const IMAGE_ATTACHMENT_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.svg',
] as const

/**
 * Detect whether a value is a renderable image attachment. Accepts a storage
 * path, a signed URL (whose query string / hash follows the extension), or a
 * file name; also detects inline `data:image/…` URLs.
 *
 * Central source of truth for the extension check so the composer preview, the
 * message bubble and file chips agree on what gets an image treatment and what
 * renders as a file chip.
 */
export function isImageAttachmentUrl(
  urlOrPath: string | null | undefined,
): boolean {
  if (!urlOrPath) return false
  if (urlOrPath.startsWith('data:image/')) return true
  const clean = urlOrPath.split('?')[0].split('#')[0].toLowerCase()
  return IMAGE_ATTACHMENT_EXTENSIONS.some((ext) => clean.endsWith(ext))
}

/**
 * Human-readable byte size for file chips: `B` below 1 KB, then KB / MB with
 * one decimal (`0 B`, `512 B`, `1.5 KB`, `10.0 MB`). Non-finite and negative
 * inputs are clamped to `0 B` — the value is display-only, never validated
 * against the 10 MB upload cap here.
 */
export function formatFileSize(bytes: number): string {
  const safe = Number.isFinite(bytes) ? Math.max(bytes, 0) : 0
  if (safe < 1024) return `${Math.round(safe)} B`
  if (safe < 1024 * 1024) return `${(safe / 1024).toFixed(1)} KB`
  return `${(safe / (1024 * 1024)).toFixed(1)} MB`
}
