import type { DataSource } from 'typeorm';
import { assertTestDatabase } from './assert-test-database';

/**
 * Rebuilds the schema from the entities on the throwaway test database.
 * `synchronize` is off outside dev, and `synchronize(true)` drops every
 * table, so the `*_test` guard runs first.
 */
export async function resetTestDatabase(dataSource: DataSource): Promise<void> {
  assertTestDatabase(process.env.DATABASE_URL);

  await dataSource.synchronize(true);
}
