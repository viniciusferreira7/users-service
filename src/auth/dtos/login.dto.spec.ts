import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { makeLoginBody } from 'test/factories/make-login-body';
import { LoginDto } from './login.dto';

/** Mirrors the global ValidationPipe options in `src/app.setup.ts`. */
async function invalidPropertiesOf(body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(LoginDto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  return errors.map((error) => error.property);
}

describe('LoginDto', () => {
  it('accepts a valid body', async () => {
    await expect(invalidPropertiesOf(makeLoginBody())).resolves.toEqual([]);
  });

  it('normalizes the email before validating it', () => {
    const dto = plainToInstance(
      LoginDto,
      makeLoginBody({ email: '  Ana@Marketplace.DEV ' })
    );

    expect(dto.email).toBe('ana@marketplace.dev');
  });

  it.each([
    ['email', 'missing', { email: undefined }],
    ['email', 'not an email', { email: 'not-an-email' }],
    ['email', 'a number', { email: 42 }],
    ['email', 'holding a lone surrogate', { email: 'a\ud800@marketplace.dev' }],
    ['password', 'missing', { password: undefined }],
    ['password', 'shorter than 6 characters', { password: '12345' }],
    ['password', 'a number', { password: 123456 }],
    ['password', 'over 72 bytes', { password: 'é'.repeat(37) }],
    ['password', 'holding a lone surrogate', { password: '\ud800abcdef' }],
    ['role', 'sent by the client', { role: 'seller' }],
    ['status', 'sent by the client', { status: 'active' }],
  ])('rejects %s when it is %s', async (property, _case, overrides) => {
    await expect(
      invalidPropertiesOf(makeLoginBody(overrides))
    ).resolves.toEqual([property]);
  });

  it('accepts a 72-byte password', async () => {
    await expect(
      invalidPropertiesOf(makeLoginBody({ password: 'a'.repeat(72) }))
    ).resolves.toEqual([]);
  });
});
