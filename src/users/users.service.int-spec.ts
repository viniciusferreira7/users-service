import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { resetTestDatabase } from 'test/utils/reset-test-database';
import { sqlStateOf } from 'test/utils/sql-state-of';
import { DataSource } from 'typeorm';
import { databaseConfig } from '@/config/database.config';
import { envSchema } from '@/env/env';
import { EnvModule } from '@/env/env.module';
import { EnvService } from '@/env/env.service';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { UserStatus } from './enums/user-status.enum';
import { UsersModule } from './users.module';
import { type CreateUserData, UsersService } from './users.service';

const data: CreateUserData = {
  email: 'ana@marketplace.dev',
  password: '$2b$10$not-a-real-hash',
  firstName: 'Ana',
  lastName: 'Souza',
  role: UserRole.SELLER,
  status: UserStatus.ACTIVE,
};

describe('UsersService (integration)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let usersService: UsersService;

  beforeAll(async () => {
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
    await resetTestDatabase(dataSource);

    usersService = moduleRef.get(UsersService);
  });

  beforeEach(async () => {
    await dataSource.getRepository(User).clear();
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('creates a user and returns it without the password hash', async () => {
    const created = await usersService.create(data);

    expect(created).toMatchObject({
      email: data.email,
      firstName: 'Ana',
      lastName: 'Souza',
      role: UserRole.SELLER,
      status: UserStatus.ACTIVE,
    });
    expect(created.id).toEqual(expect.any(String));
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.password).toBeUndefined();
  });

  it('finds a created user by email', async () => {
    const created = await usersService.create(data);

    await expect(usersService.findByEmail(data.email)).resolves.toMatchObject({
      id: created.id,
    });
  });

  it('answers null for an unknown email', async () => {
    await expect(
      usersService.findByEmail('nobody@marketplace.dev')
    ).resolves.toBeNull();
  });

  it('rejects a second user with the same email with a unique violation', async () => {
    await usersService.create(data);

    // 23505 = unique_violation
    await expect(sqlStateOf(usersService.create(data))).resolves.toBe('23505');
  });
});
