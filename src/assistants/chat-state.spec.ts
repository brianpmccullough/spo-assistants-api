import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { ChatRole } from './chat-role';
import { ChatState, MAX_HISTORY_LENGTH } from './chat-state';

function buildHistory(length: number) {
  return Array.from({ length }, (_, index) => ({
    role: ChatRole.User,
    content: `message ${index}`,
    timestamp: index,
  }));
}

function validate(plain: object) {
  return validateSync(plainToInstance(ChatState, plain));
}

describe('ChatState', () => {
  const chatId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

  it('passes validation with a history at the maximum length', () => {
    const errors = validate({
      chatId,
      history: buildHistory(MAX_HISTORY_LENGTH),
      signature: 'signature',
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects a history longer than the maximum length', () => {
    const errors = validate({
      chatId,
      history: buildHistory(MAX_HISTORY_LENGTH + 1),
      signature: 'signature',
    });

    expect(errors.some((error) => error.property === 'history')).toBe(true);
  });
});
