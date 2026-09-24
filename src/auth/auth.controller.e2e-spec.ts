import type { INestApplication } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { getRepositoryToken } from '@nestjs/typeorm';
import { compare, getRounds } from 'bcryptjs';
import request from 'supertest';
import { makeModuleRef, startApp } from 'test/factories/make-module-ref';
import { makeRegisterBody } from 'test/factories/make-register-body';
import { resetTestDatabase } from 'test/utils/reset-test-database';
import { DataSource, type Repository } from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { REGISTER_THROTTLE } from './auth-throttles';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('POST /auth/register (E2E)', () => {
  let app: INestApplication;
  let users: Repository<User>;

  const register = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/auth/register').send(body);

  beforeAll(async () => {
    // The limit has its own describe below; here it would trip mid-suite.
    const moduleRef = await makeModuleRef((builder) =>
      builder
        .overrideGuard(ThrottlerGuard)
        .useValue({ canActivate: () => true })
    );

    await resetTestDatabase(moduleRef.get(DataSource));

    app = await startApp(moduleRef);
    users = moduleRef.get(getRepositoryToken(User));
  });

  beforeEach(async () => {
    await users.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates the user and answers 201 with its public fields only', async () => {
    const response = await register(makeRegisterBody()).expect(201);

    expect(response.body).toEqual({
      id: expect.stringMatching(UUID),
      email: 'ana@marketplace.dev',
      firstName: 'Ana',
      lastName: 'Souza',
      role: 'buyer',
      status: 'active',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(response.body).not.toHaveProperty('password');
  });

  it('stores the new user as active', async () => {
    await register(makeRegisterBody()).expect(201);

    const stored = await users.findOneByOrFail({
      email: 'ana@marketplace.dev',
    });

    expect(stored.status).toBe('active');
  });

  it('stores a 10-round bcrypt hash that matches the password', async () => {
    await register(makeRegisterBody({ password: 'secret123' })).expect(201);

    const { password } = await users
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email: 'ana@marketplace.dev' })
      .getOneOrFail();

    expect(password).not.toBe('secret123');
    expect(getRounds(password)).toBe(10);
    await expect(compare('secret123', password)).resolves.toBe(true);
  });

  it('normalizes the email in the response and in the database', async () => {
    const response = await register(
      makeRegisterBody({ email: '  Ana@Marketplace.DEV ' })
    ).expect(201);

    expect(response.body.email).toBe('ana@marketplace.dev');
    await expect(
      users.existsBy({ email: 'ana@marketplace.dev' })
    ).resolves.toBe(true);
  });

  it.each([
    ['email', { email: undefined }],
    ['email', { email: 'not-an-email' }],
    ['password', { password: undefined }],
    ['password', { password: '12345' }],
    ['password', { password: 'é'.repeat(37) }],
    ['firstName', { firstName: undefined }],
    ['firstName', { firstName: '' }],
    ['firstName', { firstName: 'a'.repeat(101) }],
    ['lastName', { lastName: undefined }],
    ['lastName', { lastName: '   ' }],
    ['lastName', { lastName: 'a'.repeat(101) }],
    ['role', { role: undefined }],
    ['role', { role: 'admin' }],
    ['status', { status: 'inactive' }],
    ['password', { password: '\ud800abcdef' }],
    ['email', { email: 'a\ud800@marketplace.dev' }],
    ['firstName', { firstName: 'Ana\u0000' }],
  ])(
    'answers 400 naming %s and saves nothing (%o)',
    async (field, overrides) => {
      const response = await register(makeRegisterBody(overrides)).expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining(field)])
      );
      await expect(users.count()).resolves.toBe(0);
    }
  );

  it('answers 400 to a malformed JSON body', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"email":')
      .expect(400);
  });

  it('answers 409 to an email that is already registered', async () => {
    await register(makeRegisterBody()).expect(201);

    const response = await register(makeRegisterBody()).expect(409);

    expect(response.body.message).toBe('Email is already registered');
    await expect(users.countBy({ email: 'ana@marketplace.dev' })).resolves.toBe(
      1
    );
  });

  it('answers 409 when the email only differs in case', async () => {
    await register(makeRegisterBody({ email: 'ana@marketplace.dev' })).expect(
      201
    );

    await register(makeRegisterBody({ email: 'ANA@marketplace.dev' })).expect(
      409
    );
  });

  it('answers 409, not 500, to concurrent registrations of the same email', async () => {
    const responses = await Promise.all([
      register(makeRegisterBody()),
      register(makeRegisterBody()),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    await expect(users.count()).resolves.toBe(1);
  });
});

describe('POST /auth/register rate limit (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await startApp(await makeModuleRef());
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers 429 once the limit is spent, and leaves the probes alone', async () => {
    const server = app.getHttpServer();

    // Invalid bodies still count: the guard runs before validation, and they
    // never touch the database.
    for (let i = 0; i < REGISTER_THROTTLE.limit; i++) {
      await request(server).post('/auth/register').send({}).expect(400);
    }

    await request(server)
      .post('/auth/register')
      .send(makeRegisterBody())
      .expect(429);
    await request(server).get('/health/live').expect(200);
  });
});
