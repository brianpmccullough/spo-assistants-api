import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { EnvironmentVariables } from './environment-variables.schema';
import type { Secrets } from './models/secrets';
import type { Settings } from './models/settings';

@Injectable()
export class ConfigurationService {
  readonly settings: Settings;
  readonly secrets: Secrets;

  constructor(configService: ConfigService<EnvironmentVariables, true>) {
    this.settings = {
      azureAdApiClientId: configService.get('AZURE_AD_API_CLIENT_ID', { infer: true }),
      azureAdTenantId: configService.get('AZURE_AD_TENANT_ID', { infer: true }),
      azureOpenAiApiVersion: configService.get('AZURE_OPENAI_API_VERSION', { infer: true }),
      azureOpenAiDeployment: configService.get('AZURE_OPENAI_DEPLOYMENT', { infer: true }),
      azureOpenAiEndpoint: configService.get('AZURE_OPENAI_ENDPOINT', { infer: true }),
      azureOpenAiMaxOutputTokens: configService.get('AZURE_OPENAI_MAX_OUTPUT_TOKENS', {
        infer: true,
      }),
      port: configService.get('PORT', { infer: true }),
      corsAllowedOrigins: ConfigurationService.parseDelimitedList(
        configService.get('CORS_ALLOWED_ORIGINS', { infer: true }),
      ),
    };
    this.secrets = {
      azureAdClientSecret: configService.get('AZURE_AD_CLIENT_SECRET', { infer: true }),
      azureOpenAiApiKey: configService.get('AZURE_OPENAI_API_KEY', { infer: true }),
    };
  }

  private static parseDelimitedList(raw: string, delimiter = ','): string[] {
    return raw
      .split(delimiter)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
}
