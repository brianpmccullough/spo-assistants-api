import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { ChatRequest, MAX_MESSAGE_LENGTH } from './chat-request';

const VALID_REQUEST = {
  message: 'What is on this site?',
  context: { siteUrl: 'https://contoso.sharepoint.com/sites/team' },
};

function validate(plain: object) {
  return validateSync(plainToInstance(ChatRequest, plain));
}

describe('ChatRequest', () => {
  it('passes validation with a well-formed request', () => {
    expect(validate(VALID_REQUEST)).toHaveLength(0);
  });

  it('rejects an empty message', () => {
    const errors = validate({ ...VALID_REQUEST, message: '' });

    expect(errors.some((error) => error.property === 'message')).toBe(true);
  });

  it('rejects a message longer than the configured maximum', () => {
    const errors = validate({ ...VALID_REQUEST, message: 'a'.repeat(MAX_MESSAGE_LENGTH + 1) });

    expect(errors.some((error) => error.property === 'message')).toBe(true);
  });

  it('accepts a message at exactly the configured maximum', () => {
    const errors = validate({ ...VALID_REQUEST, message: 'a'.repeat(MAX_MESSAGE_LENGTH) });

    expect(errors).toHaveLength(0);
  });
});
