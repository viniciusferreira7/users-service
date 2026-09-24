import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { makeRegisterBody } from 'test/factories/make-register-body';
import { RegisterDto } from './register.dto';

/** Mirrors the global ValidationPipe options in `src/app.setup.ts`. */
async function invalidPropertiesOf(body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(RegisterDto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  return errors.map((error) => error.property);
}

// 255 characters: one past what `isEmail` accepts, and past the column.
const tooLongEmail = `${'a'.repeat(64)}@b${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(57)}.dev`;

describe('RegisterDto', () => {
  it('accepts a valid body', async () => {
    await expect(invalidPropertiesOf(makeRegisterBody())).resolves.toEqual([]);
  });

  it('normalizes the email before validating it', () => {
    const dto = plainToInstance(
      RegisterDto,
      makeRegisterBody({ email: '  Ana@Marketplace.DEV ' })
    );

    expect(dto.email).toBe('ana@marketplace.dev');
  });

  it.each([
    ['email', 'missing', { email: undefined }],
    ['email', 'not an email', { email: 'not-an-email' }],
    ['email', 'a number', { email: 42 }],
    ['email', 'an array', { email: ['ana@marketplace.dev'] }],
    ['email', 'longer than 254 characters', { email: tooLongEmail }],
    ['password', 'missing', { password: undefined }],
    ['password', 'shorter than 6 characters', { password: '12345' }],
    ['password', 'a number', { password: 123456 }],
    ['password', 'null', { password: null }],
    [
      'password',
      'over 72 bytes but only 37 characters',
      { password: 'é'.repeat(37) },
    ],
    ['password', 'over 72 ASCII bytes', { password: 'a'.repeat(73) }],
    ['firstName', 'missing', { firstName: undefined }],
    ['firstName', 'empty', { firstName: '' }],
    ['firstName', 'whitespace only', { firstName: '   ' }],
    ['firstName', 'longer than 100 characters', { firstName: 'a'.repeat(101) }],
    ['lastName', 'missing', { lastName: undefined }],
    ['lastName', 'empty', { lastName: '' }],
    ['lastName', 'whitespace only', { lastName: '   ' }],
    ['lastName', 'longer than 100 characters', { lastName: 'a'.repeat(101) }],
    ['role', 'missing', { role: undefined }],
    ['role', 'outside seller and buyer', { role: 'admin' }],
    ['status', 'sent by the client', { status: 'inactive' }],
  ])('rejects %s when it is %s', async (property, _case, overrides) => {
    await expect(
      invalidPropertiesOf(makeRegisterBody(overrides))
    ).resolves.toEqual([property]);
  });

  it.each([
    ['a 6-character password', { password: '123456' }],
    ['a 72-byte password', { password: 'a'.repeat(72) }],
    [
      '100-character names',
      { firstName: 'a'.repeat(100), lastName: 'b'.repeat(100) },
    ],
    ['the seller role', { role: 'seller' }],
  ])('accepts %s', async (_case, overrides) => {
    await expect(
      invalidPropertiesOf(makeRegisterBody(overrides))
    ).resolves.toEqual([]);
  });
});
