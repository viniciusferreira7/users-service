import { DataSource } from 'typeorm';
import { envSchema } from '../env/env';
import { User } from '../users/entities/user.entity';
import { migrations } from './migrations';

/**
 * The DataSource the TypeORM CLI (`pnpm migration:*`) loads. The scripts run
 * with `--env-file-if-exists=.env`, and the same Zod schema as the app
 * validates the connection before anything touches the database.
 */
const env = envSchema.parse(process.env);

export default new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  entities: [User],
  migrations,
});
