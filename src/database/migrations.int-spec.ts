import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { assertTestDatabase } from 'test/utils/assert-test-database';
import { DataSource } from 'typeorm';
import { databaseConfig } from '@/config/database.config';
import { envSchema } from '@/env/env';
import { EnvModule } from '@/env/env.module';
import { EnvService } from '@/env/env.service';
import { UsersModule } from '@/users/users.module';

describe('Migrations (integration)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;

  beforeAll(async () => {
    assertTestDatabase(process.env.DATABASE_URL);

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validate: (env) => envSchema.parse(env),
        }),
        EnvModule,
        TypeOrmModule.forRootAsync({
          imports: [EnvModule],
          inject: [EnvService],
          useFactory: databaseConfig,
        }),
        UsersModule,
      ],
    }).compile();

    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('builds exactly the schema the entities declare from an empty database', async () => {
    await dataSource.dropDatabase();

    const applied = await dataSource.runMigrations();
    const pending = await dataSource.driver.createSchemaBuilder().log();

    expect(applied.length).toBeGreaterThan(0);
    // Anything left here is a column/constraint the entities declare but no
    // migration creates — production (which never synchronizes) would miss it.
    expect(pending.upQueries.map((query) => query.query)).toEqual([]);
  });

  it('has nothing left to run once applied', async () => {
    await expect(dataSource.showMigrations()).resolves.toBe(false);
  });
});
