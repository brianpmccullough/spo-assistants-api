import { IsEnum, IsNumber, IsString } from 'class-validator';

import { ChatRole } from './chat-role';

export class ChatMessage {
  @IsEnum(ChatRole)
  role!: ChatRole;

  @IsString()
  content!: string;

  @IsNumber()
  timestamp!: number;
}
