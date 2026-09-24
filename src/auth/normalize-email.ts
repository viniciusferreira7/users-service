/**
 * Canonical form of an email, so `Ana@Email.com ` and `ana@email.com` are the
 * same account.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
