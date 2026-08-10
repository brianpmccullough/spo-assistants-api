import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { ChatRequestMessage } from './chat-request-message';
import { PageContext } from './page-context';

/** Upper bound on turns per request. */
export const MAX_MESSAGES_PER_REQUEST = 100;

export class ChatRequest {
  /**
   * Should be omitted on first turn allowing server to populate.  Meant for correlation
   * only — so this identifies a conversation for logging and possible future persistence.
   */
  @IsOptional()
  @IsString()
  chatId?: string;

  /**
   * The full conversation, oldest first. The client owns this history for now, which
   * makes it a trust boundary: an `assistant` turn is replayed to the model as its own
   * prior output, so a caller can put words in the model's mouth and nothing on the
   * server can detect it. Accepted cost of the stateless design — the fix is
   * server-side conversation state, not more validation here.
   */
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_MESSAGES_PER_REQUEST)
  @ValidateNested({ each: true })
  @Type(() => ChatRequestMessage)
  messages!: ChatRequestMessage[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PageContext)
  pageContext?: PageContext;
}
