import { setTracingDisabled } from '@openai/agents';
import { AzureOpenAI } from 'openai';

import { ConfigurationService } from '../configuration/configuration.service';

/**
 * Injection token for the Azure OpenAI client. Services inject this rather than
 * constructing a client, so the client arrives through DI and can be faked in
 * tests. Extract into its own module if something outside `assistants/` ever
 * needs it.
 */
export const AZURE_OPENAI_CLIENT = 'AZURE_OPENAI_CLIENT';

export function createAzureOpenAiClient(configuration: ConfigurationService): AzureOpenAI {
  // Tracing defaults to ON and exports prompts and completions to OpenAI's trace
  // endpoint. This call is what guarantees it stays off; `OPENAI_AGENTS_DISABLE_TRACING=1`
  // on the deployed environment is defense in depth for anything that never reaches
  // this factory. Kept here rather than in `main.ts` so Agents SDK imports stay
  // confined to the file that owns the SDK client.
  setTracingDisabled(true);

  return new AzureOpenAI({
    endpoint: configuration.settings.azureOpenAiEndpoint,
    apiVersion: configuration.settings.azureOpenAiApiVersion,
    apiKey: configuration.secrets.azureOpenAiApiKey,
    deployment: configuration.settings.azureOpenAiDeployment,
  });
}
