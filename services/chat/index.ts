// src/services/chat/index.ts
export {
  sendMessage,
  getMessages,
  getInbox,
  markMessagesAsRead,
  getUnreadCount,
  createAttachmentUpload,
  getAttachmentUrl,
  searchMessages,
} from './chat.service'

export type { Message, ConversationSummary } from './chat.service'
export { sendMessageSchema } from './message.schema'
export type { SendMessageInput } from './message.schema'

export {
  toggleReaction,
  removeReaction,
  getReactions,
} from './reaction.service'
export { toggleReactionSchema, listReactionsSchema } from './reaction.schema'
export type { ToggleReactionInput, ListReactionsInput } from './reaction.schema'
