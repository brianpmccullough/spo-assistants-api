import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { EnvironmentVariables } from './environment-variables.schema';

export interface Settings {
  readonly port: number;
  readonly corsAllowedOrigins: string[];
}

// No secrets defined yet. Add fields here as they're introduced, alongside
// an entry in docs/env.md (name and purpose only, never the value).
export type Secrets = Record<string, never>;

@Injectable()
export class ConfigurationService {
  readonly settings: Settings;
  readonly secrets: Secrets;

  constructor(configService: ConfigService<EnvironmentVariables, true>) {
    this.settings = {
      port: configService.get('PORT', { infer: true }),
      corsAllowedOrigins: ConfigurationService.parseDelimitedList(
        configService.get('CORS_ALLOWED_ORIGINS', { infer: true }),
      ),
    };
    this.secrets = {};
  }

  private static parseDelimitedList(raw: string, delimiter = ','): string[] {
    return raw
      .split(delimiter)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
}
