import { getRounds, hashSync } from 'bcryptjs';
import { verifyPassword } from './password';

const storedHash = hashSync('secret123', 4);

describe('verifyPassword', () => {
  it('accepts the password the hash was made from', async () => {
    await expect(verifyPassword('secret123', storedHash)).resolves.toBe(true);
  });

  it('rejects a different password', async () => {
    await expect(verifyPassword('wrong-password', storedHash)).resolves.toBe(
      false
    );
  });

  it('answers false without a hash', async () => {
    await expect(verifyPassword('secret123', null)).resolves.toBe(false);
    await expect(verifyPassword('secret123', undefined)).resolves.toBe(false);
  });

  it('still spends a cost-10 bcrypt comparison when there is no hash', async () => {
    const compareFn = vi.fn(async (_password: string, _hash: string) => true);

    await expect(verifyPassword('secret123', null, compareFn)).resolves.toBe(
      false
    );
    expect(compareFn).toHaveBeenCalledTimes(1);
    const [, comparedHash] = compareFn.mock.calls[0];
    expect(getRounds(comparedHash)).toBe(10);
  });

  it('answers false instead of throwing on a corrupt stored hash', async () => {
    await expect(
      verifyPassword('secret123', 'not-a-bcrypt-hash')
    ).resolves.toBe(false);
    await expect(verifyPassword('secret123', '')).resolves.toBe(false);
  });
});
