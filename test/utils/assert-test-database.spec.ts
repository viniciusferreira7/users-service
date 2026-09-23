import { assertTestDatabase } from './assert-test-database';

describe('assertTestDatabase', () => {
  it('accepts a database whose name ends in _test', () => {
    expect(() =>
      assertTestDatabase('postgres://test:test@localhost:5436/users_db_test')
    ).not.toThrow();
  });

  it('refuses the dev database', () => {
    expect(() =>
      assertTestDatabase('postgres://postgres:postgres@localhost:5435/users_db')
    ).toThrow(/users_db/);
  });

  it('refuses a missing url', () => {
    expect(() => assertTestDatabase(undefined)).toThrow();
  });
});
