import type { DataSource } from 'typeorm';
import { assertTestDatabase } from './assert-test-database';

/**
 * Rebuilds the schema on the throwaway test database from the real
 * migrations, so every spec runs against exactly what production gets.
 * `dropDatabase()` wipes every table, so the `*_test` guard runs first.
 */
export async function resetTestDatabase(dataSource: DataSource): Promise<void> {
  assertTestDatabase(process.env.DATABASE_URL);

  await dataSource.dropDatabase();
  await dataSource.runMigrations();
}
