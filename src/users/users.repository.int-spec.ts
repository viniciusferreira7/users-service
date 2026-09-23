import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { assertTestDatabase } from 'test/utils/assert-test-database';
import { DataSource, type Repository } from 'typeorm';
import { databaseConfig } from '@/config/database.config';
import { envSchema } from '@/env/env';
import { EnvModule } from '@/env/env.module';
import { EnvService } from '@/env/env.service';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { UserStatus } from './enums/user-status.enum';
import { UsersModule } from './users.module';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function makeUser(overrides: Partial<User> = {}): Partial<User> {
  return {
    email: 'ana@marketplace.dev',
    password: '$2b$10$not-a-real-hash',
    firstName: 'Ana',
    lastName: 'Souza',
    role: UserRole.BUYER,
    ...overrides,
  };
}

/** Postgres SQLSTATE carried by a failed query. */
async function sqlStateOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (
      (error as { driverError?: { code?: string } }).driverError?.code ?? ''
    );
  }

  throw new Error('Expected the query to fail');
}

describe('User persistence (integration)', () => {
  let moduleRef: TestingModule;
  let users: Repository<User>;

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

    // `synchronize` is off outside dev, so build the schema on the throwaway
    // database from the entity itself.
    await moduleRef.get(DataSource).synchronize(true);

    users = moduleRef.get(getRepositoryToken(User));
  });

  beforeEach(async () => {
    await users.clear();
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('saves a user with a generated uuid', async () => {
    const saved = await users.save(users.create(makeUser()));

    expect(saved.id).toMatch(UUID);
  });

  it('creates users as active', async () => {
    const { id } = await users.save(users.create(makeUser()));

    const found = await users.findOneByOrFail({ id });

    expect(found.status).toBe(UserStatus.ACTIVE);
  });

  it('timestamps creation and moves updatedAt on update', async () => {
    const { id } = await users.save(users.create(makeUser()));
    const created = await users.findOneByOrFail({ id });

    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);

    await new Promise((resolve) => setTimeout(resolve, 20));
    await users.update(id, { firstName: 'Ana Paula' });

    const updated = await users.findOneByOrFail({ id });

    expect(updated.updatedAt.getTime()).toBeGreaterThan(
      created.updatedAt.getTime()
    );
    expect(updated.createdAt).toEqual(created.createdAt);
  });

  it('rejects a second user with the same email', async () => {
    await users.save(users.create(makeUser()));

    // 23505 = unique_violation
    await expect(sqlStateOf(users.insert(makeUser()))).resolves.toBe('23505');
  });

  it('rejects a role outside seller and buyer', async () => {
    // 22P02 = invalid_text_representation (bad enum label)
    await expect(
      sqlStateOf(users.insert(makeUser({ role: 'admin' as UserRole })))
    ).resolves.toBe('22P02');
  });

  it('rejects a status outside active and inactive', async () => {
    await expect(
      sqlStateOf(users.insert(makeUser({ status: 'deleted' as UserStatus })))
    ).resolves.toBe('22P02');
  });

  it('never returns the password hash from a default read', async () => {
    const { id } = await users.save(users.create(makeUser()));

    const viaRepository = await users.findOneByOrFail({ id });
    const viaQueryBuilder = await users
      .createQueryBuilder('user')
      .where('user.id = :id', { id })
      .getOneOrFail();

    // Class fields are defined on every instance, so the key exists as
    // `undefined`; what matters is that the hash was never loaded.
    expect(viaRepository.password).toBeUndefined();
    expect(viaQueryBuilder.password).toBeUndefined();
  });

  it('returns the password hash only when asked for explicitly', async () => {
    const { id } = await users.save(users.create(makeUser()));

    const withPassword = await users
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id })
      .getOneOrFail();

    expect(withPassword.password).toBe('$2b$10$not-a-real-hash');
  });
});
