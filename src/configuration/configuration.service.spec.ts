import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { ConfigurationService } from './configuration.service';
import { EnvironmentVariables } from './environment-variables.schema';

async function createConfigurationService(
  environmentVariables: Partial<EnvironmentVariables>,
): Promise<ConfigurationService> {
  const merged = { ...new EnvironmentVariables(), ...environmentVariables };
  const moduleReference = await Test.createTestingModule({
    providers: [
      ConfigurationService,
      {
        provide: ConfigService,
        useValue: {
          get: (key: keyof EnvironmentVariables) => merged[key],
        },
      },
    ],
  }).compile();
  return moduleReference.get(ConfigurationService);
}

describe('ConfigurationService', () => {
  it('exposes the configured port', async () => {
    const configuration = await createConfigurationService({ PORT: 4000 });

    expect(configuration.settings.port).toBe(4000);
  });

  it('parses a comma-separated origin list, trimming whitespace', async () => {
    const configuration = await createConfigurationService({
      CORS_ALLOWED_ORIGINS: 'https://a.example.com, https://b.example.com',
    });

    expect(configuration.settings.corsAllowedOrigins).toEqual([
      'https://a.example.com',
      'https://b.example.com',
    ]);
  });

  it('exposes an empty secrets object when none are configured', async () => {
    const configuration = await createConfigurationService({});

    expect(configuration.secrets).toEqual({});
  });
});
