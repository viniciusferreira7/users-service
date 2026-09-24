/**
 * A valid `POST /auth/register` body. Overrides set to `undefined` drop the
 * property, so a spec can send a body with a field missing.
 */
export function makeRegisterBody(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    email: 'ana@marketplace.dev',
    password: 'secret123',
    firstName: 'Ana',
    lastName: 'Souza',
    role: 'buyer',
    ...overrides,
  };

  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) {
      delete body[key];
    }
  }

  return body;
}
