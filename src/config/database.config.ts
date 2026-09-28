import { TypeOrmModuleOptions } from '@nestjs/typeorm';

import { migrations } from '../database/migrations';
import { EnvService } from '../env/env.service';

/**
 * TypeORM options built from the validated environment. Takes `EnvService`
 * instead of reading `process.env`, so the values are the ones the Zod schema
 * already parsed and typed.
 */
export function databaseConfig(env: EnvService): TypeOrmModuleOptions {
  const nodeEnv = env.get('NODE_ENV');

  return {
    type: 'postgres',
    url: env.get('DATABASE_URL'),
    autoLoadEntities: true,
    // The schema only changes through migrations, in every environment, so
    // dev and production can never drift apart.
    synchronize: false,
    migrations,
    migrationsRun: true,
    logging: nodeEnv !== 'production',
  };
}
