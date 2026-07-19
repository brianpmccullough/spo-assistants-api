import { DEFAULTS, validate } from './environment-variables.schema';

describe('validate', () => {
  it('applies defaults when variables are unset', () => {
    const environmentVariables = validate({});

    expect(environmentVariables.PORT).toBe(DEFAULTS.PORT);
    expect(environmentVariables.CORS_ALLOWED_ORIGINS).toBe(DEFAULTS.CORS_ALLOWED_ORIGINS);
  });

  it('coerces PORT to a number', () => {
    const environmentVariables = validate({ PORT: '4000' });

    expect(environmentVariables.PORT).toBe(4000);
  });

  it('throws with a readable message on invalid input', () => {
    expect(() => validate({ PORT: 'not-a-number' })).toThrow(/PORT/);
  });
});
