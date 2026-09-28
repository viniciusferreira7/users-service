/**
 * Every migration, in order. Listed explicitly instead of globbed so the same
 * array works under ts-node (CLI), swc (Vitest) and the compiled `dist/`.
 * `pnpm migration:generate` writes the file; add its class here.
 */
import { CreateUsersTable1790611278549 } from './1790611278549-CreateUsersTable';

export const migrations = [CreateUsersTable1790611278549];
