// src/lib/chat/composer-input.ts
// Pure composer-input rules shared by the MessageComposer (UI-08). Kept
// synchronous and side-effect free so the send affordance is unit-testable
// without a DOM, matching the connection-state module in the same folder.

/** DB parity with messages.content check (1..2000 chars). */
export const COMPOSER_MAX_CHARS = 2000

/**
 * Normalize the draft for a send. Mirrors the server schema's content
 * transform so the optimistic copy and the persisted copy never disagree.
 */
export function cleanComposerText(text: string): string {
  return text.trim()
}

/**
 * A send is enabled when the draft has real text OR an attachment is queued
 * (an attachment-only send is valid; the server captions it).
 */
export function canSubmitDraft(text: string, hasAttachment: boolean): boolean {
  return hasAttachment || cleanComposerText(text).length > 0
}
