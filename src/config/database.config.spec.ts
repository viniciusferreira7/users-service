import { migrations } from '../database/migrations';
import type { EnvService } from '../env/env.service';
import { databaseConfig } from './database.config';

const values: Record<string, unknown> = {
  NODE_ENV: 'dev',
  DATABASE_URL: 'postgres://user:pass@localhost:5435/users_db',
};

function makeEnv(overrides: Record<string, unknown> = {}): EnvService {
  const env = { ...values, ...overrides };

  return { get: vi.fn((key: string) => env[key]) } as unknown as EnvService;
}

describe('databaseConfig', () => {
  it('builds a postgres connection from the validated environment', () => {
    expect(databaseConfig(makeEnv())).toMatchObject({
      type: 'postgres',
      url: 'postgres://user:pass@localhost:5435/users_db',
      autoLoadEntities: true,
    });
  });

  it('never synchronizes: every environment runs the migrations on boot', () => {
    for (const NODE_ENV of ['dev', 'test', 'production']) {
      expect(databaseConfig(makeEnv({ NODE_ENV }))).toMatchObject({
        synchronize: false,
        migrationsRun: true,
        migrations,
      });
    }
  });

  it('silences query logging in production only', () => {
    expect(databaseConfig(makeEnv({ NODE_ENV: 'production' }))).toMatchObject({
      logging: false,
    });
    expect(databaseConfig(makeEnv({ NODE_ENV: 'dev' }))).toMatchObject({
      logging: true,
    });
  });

  it('reads the connection from EnvService, never from process.env', () => {
    const env = makeEnv();

    databaseConfig(env);

    expect(env.get).toHaveBeenCalledWith('DATABASE_URL');
  });
});
