import { randomUUID } from 'node:crypto';
import { compare, hashSync } from 'bcryptjs';

export const PASSWORD_SALT_ROUNDS = 10;

/**
 * Stands in for the stored hash when the email is unknown, so that path
 * spends one bcrypt comparison like a wrong password does and the response
 * time does not reveal which emails are registered. Same cost as real hashes;
 * its plain text is discarded.
 */
const DUMMY_HASH = hashSync(randomUUID(), PASSWORD_SALT_ROUNDS);

type Compare = (password: string, hash: string) => Promise<boolean>;

/**
 * Checks a password against a stored bcrypt hash. Without a hash it still
 * runs a comparison and answers false; a malformed hash answers false instead
 * of throwing.
 */
export async function verifyPassword(
  password: string,
  hash: string | null | undefined,
  compareFn: Compare = compare
): Promise<boolean> {
  try {
    const matches = await compareFn(password, hash || DUMMY_HASH);

    return Boolean(hash) && matches;
  } catch {
    return false;
  }
}
