export interface Settings {
  readonly azureAdApiClientId: string;
  readonly azureAdTenantId: string;
  readonly azureOpenAiApiVersion: string;
  readonly azureOpenAiDeployment: string;
  readonly azureOpenAiEndpoint: string;
  readonly azureOpenAiMaxOutputTokens: number;
  readonly port: number;
  readonly corsAllowedOrigins: string[];
}
