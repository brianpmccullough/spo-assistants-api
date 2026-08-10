import type { ChatRole } from './chat-role';

/**
 * A single turn as this server returns it. Outbound only — nothing here is
 * validated, because every field is server-produced. The inbound shape is
 * `ChatRequestMessage`, which carries no `id` and validates what it accepts.
 */
export interface ChatMessage {
  /** Server-minted identifier. */
  readonly id: string;
  readonly role: ChatRole;
  readonly content: string;
}
