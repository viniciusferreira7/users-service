/**
 * A valid `POST /auth/login` body for the user `makeRegisterBody` creates.
 * Overrides set to `undefined` drop the property.
 */
export function makeLoginBody(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    email: 'ana@marketplace.dev',
    password: 'secret123',
    ...overrides,
  };

  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) {
      delete body[key];
    }
  }

  return body;
}
