import { createHmac, timingSafeEqual } from 'crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ChatMessage } from './chat-message';
import { AuthenticatedUser } from '../auth/authenticated-user';

@Injectable()
export class ChatIntegrityService {
  private readonly secret: string;

  constructor(private readonly config: ConfigService) {
    this.secret = config.getOrThrow('CHAT_HMAC_SECRET');
  }

  sign(user: AuthenticatedUser, history: ChatMessage[]): string {
    const payload =
      `${user.id}\n` + history.map((message) => `${message.role}:${message.content}`).join('\n');
    return createHmac('sha256', this.secret).update(payload).digest('base64url');
  }

  verify(user: AuthenticatedUser, history: ChatMessage[], signature: string): boolean {
    const expected = this.sign(user, history);
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }
}
