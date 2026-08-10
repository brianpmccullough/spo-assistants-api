// class-validator/class-transformer decorators (@Type, @IsInt, etc.) store
// their metadata via reflect-metadata at runtime; @nestjs/core polyfills this
// as a side effect when the app boots, but this module needs to work
// standalone too (e.g. under Jest, importing only this file).
import 'reflect-metadata';

import { plainToInstance, Type } from 'class-transformer';
import {
  IsInt,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
  type ValidationError,
} from 'class-validator';

export const DEFAULTS = {
  PORT: 3000,
  CORS_ALLOWED_ORIGINS: 'https://localhost:4321',
  AZURE_OPENAI_API_VERSION: '2024-10-21',
};

export class EnvironmentVariables {
  @IsString()
  AZURE_AD_API_CLIENT_ID!: string;

  @IsString()
  AZURE_AD_CLIENT_SECRET!: string;

  @IsString()
  AZURE_AD_TENANT_ID!: string;

  @IsString()
  AZURE_OPENAI_API_KEY!: string;

  @IsString()
  AZURE_OPENAI_API_VERSION: string = DEFAULTS.AZURE_OPENAI_API_VERSION;

  @IsString()
  AZURE_OPENAI_DEPLOYMENT!: string;

  // `require_tld: false` so a local mock or proxy on a bare hostname still boots;
  // the point is to fail a malformed endpoint at startup rather than at first request.
  @IsUrl({ require_tld: false })
  AZURE_OPENAI_ENDPOINT!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = DEFAULTS.PORT;

  @IsString()
  CORS_ALLOWED_ORIGINS: string = DEFAULTS.CORS_ALLOWED_ORIGINS;
}

function formatValidationError(error: ValidationError): string {
  return `  ${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`;
}

export function validate(environmentVariables: Record<string, unknown>): EnvironmentVariables {
  const validatedEnvironmentVariables = plainToInstance(EnvironmentVariables, environmentVariables);
  const errors = validateSync(validatedEnvironmentVariables);

  if (errors.length > 0) {
    const issues = errors.map(formatValidationError).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return validatedEnvironmentVariables;
}
