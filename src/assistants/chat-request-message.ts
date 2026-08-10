import {
  IsEnum,
  IsString,
  Validate,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';

import { ChatRole } from './chat-role';

/**
 * Upper bound on a message the user typed. Deliberately well under the body-parser
 * limit so an oversized message is rejected as a 400 naming the offending field,
 * rather than a bare 413 from Express.
 */
export const MAX_USER_MESSAGE_LENGTH = 1_000;

/**
 * Upper bound on a replayed assistant turn. Larger than the user bound because the
 * client is handing back what this server previously produced, and nothing caps the
 * model's output at the user limit — holding both to 1,000 would 400 the follow-up
 * request after any answer longer than that.
 */
export const MAX_ASSISTANT_MESSAGE_LENGTH = 8_000;

@ValidatorConstraint({ name: 'maxLengthForRole' })
class MaxLengthForRoleConstraint implements ValidatorConstraintInterface {
  validate(content: unknown, args: ValidationArguments): boolean {
    if (typeof content !== 'string') {
      return true; // @IsString reports this; don't double-report.
    }
    return content.length <= MaxLengthForRoleConstraint.limitFor(args);
  }

  defaultMessage(args: ValidationArguments): string {
    return `content must be shorter than or equal to ${MaxLengthForRoleConstraint.limitFor(args)} characters`;
  }

  private static limitFor(args: ValidationArguments): number {
    const { role } = args.object as ChatRequestMessage;
    return role === ChatRole.Assistant ? MAX_ASSISTANT_MESSAGE_LENGTH : MAX_USER_MESSAGE_LENGTH;
  }
}

/**
 * A single turn as it arrives from the client. Distinct from `ChatMessage` (the
 * outbound model) because the two contracts differ: there is no `id` here, since
 * ids are server-minted, and the length bound depends on who wrote the turn.
 *
 * Note that the client owns the conversation history, so an `assistant` turn here
 * is only a claim about what this server previously said — it is replayed to the
 * model as genuine prior output and cannot be verified. See `chat-request.ts`.
 */
export class ChatRequestMessage {
  @IsEnum(ChatRole)
  role!: ChatRole;

  @IsString()
  @Validate(MaxLengthForRoleConstraint)
  content!: string;
}
