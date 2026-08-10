import type { ChatMessage } from './chat-message';

/**
 * Later additions (citations, tool activity, usage) are additive and non-breaking for clients.
 */
export interface ChatResponse {
  readonly chatId: string;
  readonly message: ChatMessage;
}
