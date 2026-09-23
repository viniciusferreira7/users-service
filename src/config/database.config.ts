import { TypeOrmModuleOptions } from '@nestjs/typeorm';

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
    synchronize: nodeEnv === 'dev',
    logging: nodeEnv !== 'production',
  };
}
