import { QueryFailedError } from 'typeorm';
import { isUniqueViolation } from './is-unique-violation';

function queryFailed(code: string) {
  return new QueryFailedError(
    'INSERT ...',
    [],
    Object.assign(new Error(), { code })
  );
}

describe('isUniqueViolation', () => {
  it('recognizes a Postgres unique_violation (23505)', () => {
    expect(isUniqueViolation(queryFailed('23505'))).toBe(true);
  });

  it('ignores other query failures', () => {
    expect(isUniqueViolation(queryFailed('22P02'))).toBe(false);
  });

  it('ignores errors that are not query failures', () => {
    expect(
      isUniqueViolation(Object.assign(new Error(), { code: '23505' }))
    ).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});
