import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { EnvironmentVariables } from './environment-variables.schema';

export interface Settings {
  readonly azureAdApiClientId: string;
  readonly azureAdTenantId: string;
  readonly port: number;
  readonly corsAllowedOrigins: string[];
}

export interface Secrets {
  readonly azureAdClientSecret: string;
}

@Injectable()
export class ConfigurationService {
  readonly settings: Settings;
  readonly secrets: Secrets;

  constructor(configService: ConfigService<EnvironmentVariables, true>) {
    this.settings = {
      azureAdApiClientId: configService.get('AZURE_AD_API_CLIENT_ID', { infer: true }),
      azureAdTenantId: configService.get('AZURE_AD_TENANT_ID', { infer: true }),
      port: configService.get('PORT', { infer: true }),
      corsAllowedOrigins: ConfigurationService.parseDelimitedList(
        configService.get('CORS_ALLOWED_ORIGINS', { infer: true }),
      ),
    };
    this.secrets = {
      azureAdClientSecret: configService.get('AZURE_AD_CLIENT_SECRET', { infer: true }),
    };
  }

  private static parseDelimitedList(raw: string, delimiter = ','): string[] {
    return raw
      .split(delimiter)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
}
