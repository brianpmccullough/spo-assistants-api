import { Type } from 'class-transformer';
import { ArrayMaxSize, IsString, IsUUID, ValidateNested } from 'class-validator';

import { ChatMessage } from './chat-message';

export const MAX_HISTORY_LENGTH = 50;

export class ChatState {
  @IsUUID()
  chatId!: string;

  @ArrayMaxSize(MAX_HISTORY_LENGTH)
  @ValidateNested({ each: true })
  @Type(() => ChatMessage)
  history!: ChatMessage[];

  @IsString()
  signature!: string;
}
