import { TokenUsage } from './token-usage';

export interface LlmResult {
  readonly content: string;
  readonly tokenUsage: TokenUsage;
}
