import { DEFAULTS, validate } from './environment-variables.schema';

const REQUIRED_VARIABLES = {
  AZURE_AD_API_CLIENT_ID: 'test-client-id',
  AZURE_AD_CLIENT_SECRET: 'test-client-secret',
  AZURE_AD_TENANT_ID: 'test-tenant-id',
  AZURE_OPENAI_API_KEY: 'test-openai-key',
  AZURE_OPENAI_DEPLOYMENT: 'test-deployment',
  AZURE_OPENAI_ENDPOINT: 'https://test-resource.openai.azure.com',
};

describe('validate', () => {
  it('applies defaults when optional variables are unset', () => {
    const environmentVariables = validate(REQUIRED_VARIABLES);

    expect(environmentVariables.PORT).toBe(DEFAULTS.PORT);
    expect(environmentVariables.CORS_ALLOWED_ORIGINS).toBe(DEFAULTS.CORS_ALLOWED_ORIGINS);
    expect(environmentVariables.AZURE_OPENAI_API_VERSION).toBe(DEFAULTS.AZURE_OPENAI_API_VERSION);
  });

  it('coerces PORT to a number', () => {
    const environmentVariables = validate({ ...REQUIRED_VARIABLES, PORT: '4000' });

    expect(environmentVariables.PORT).toBe(4000);
  });

  it('throws with a readable message on invalid input', () => {
    expect(() => validate({ ...REQUIRED_VARIABLES, PORT: 'not-a-number' })).toThrow(/PORT/);
  });

  it('throws when a required variable is missing', () => {
    expect(() => validate({})).toThrow(/AZURE_AD_API_CLIENT_ID/);
  });
});
