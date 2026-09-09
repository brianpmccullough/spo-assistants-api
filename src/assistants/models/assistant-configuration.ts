/**
 * What the client needs before the first message. Served from the API so the
 * greeting and prompts can change without redeploying the SPFx package to the
 * tenant.
 */
export interface AssistantConfiguration {
  readonly assistantId: string;
  readonly greeting: string;
  readonly starterPrompts: readonly string[];
}
