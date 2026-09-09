import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

import { ChatState } from './chat-state';
import { SharePointContext } from './sharepoint-context';

export const MAX_MESSAGE_LENGTH = 4000;

export class ChatRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MESSAGE_LENGTH)
  message!: string;

  @ValidateNested()
  @Type(() => SharePointContext)
  context!: SharePointContext;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChatState)
  state?: ChatState;
}
