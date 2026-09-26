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

  it('loads the password hash when looking a user up for a login', async () => {
    await usersService.create(data);

    const found = await usersService.findByEmailWithPassword(data.email);

    expect(found).toMatchObject({
      email: data.email,
      status: UserStatus.ACTIVE,
    });
    expect(found?.password).toBe(data.password);
  });

  it('answers null to a login lookup for an unknown email', async () => {
    await expect(
      usersService.findByEmailWithPassword('nobody@marketplace.dev')
    ).resolves.toBeNull();
  });

  it('keeps the hash out of the regular email lookup', async () => {
    await usersService.create(data);

    const found = await usersService.findByEmail(data.email);

    expect(found?.password).toBeUndefined();
  });

  it('finds a created user by id without the password hash', async () => {
    const created = await usersService.create(data);

    const found = await usersService.findById(created.id);

    expect(found).toMatchObject({ id: created.id, email: data.email });
    expect(found?.password).toBeUndefined();
  });

  it('answers null for an unknown id', async () => {
    await expect(
      usersService.findById('00000000-0000-4000-8000-000000000000')
    ).resolves.toBeNull();
  });

  it('lists only active sellers, sorted by name, without password hashes', async () => {
    await usersService.create({
      ...data,
      email: 'caio@marketplace.dev',
      firstName: 'Caio',
    });
    await usersService.create({ ...data, email: 'ana@marketplace.dev' });
    await usersService.create({
      ...data,
      email: 'bia@marketplace.dev',
      firstName: 'Bia',
      role: UserRole.BUYER,
    });
    await usersService.create({
      ...data,
      email: 'davi@marketplace.dev',
      firstName: 'Davi',
      status: UserStatus.INACTIVE,
    });

    const sellers = await usersService.findActiveSellers();

    expect(sellers.map((seller) => seller.firstName)).toEqual(['Ana', 'Caio']);
    for (const seller of sellers) {
      expect(seller.password).toBeUndefined();
    }
  });
});
