import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { makeLoginBody } from 'test/factories/make-login-body';
import { makeModuleRef, startApp } from 'test/factories/make-module-ref';
import { makeRegisterBody } from 'test/factories/make-register-body';
import { resetTestDatabase } from 'test/utils/reset-test-database';
import { DataSource, type Repository } from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { UserStatus } from '@/users/enums/user-status.enum';
import { LOGIN_THROTTLE } from './auth-throttles';

describe('POST /auth/login (E2E)', () => {
  let app: INestApplication;
  let users: Repository<User>;

  const login = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/auth/login').send(body);

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
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(makeRegisterBody({ role: 'seller' }))
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers 200 with the public user and a token', async () => {
    const response = await login(makeLoginBody()).expect(200);

    expect(response.body).toEqual({
      user: {
        id: expect.any(String),
        email: 'ana@marketplace.dev',
        firstName: 'Ana',
        lastName: 'Souza',
        role: 'seller',
        status: 'active',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
      token: expect.any(String),
    });
  });

  it('issues a token the shared JWT_SECRET verifies, for 24 hours, with only sub, email and role', async () => {
    const response = await login(makeLoginBody()).expect(200);

    // Independent of the app's JwtService: the secret and algorithm the
    // api-gateway will use.
    const verifier = new JwtService({
      secret: process.env.JWT_SECRET,
      verifyOptions: { algorithms: ['HS256'] },
    });
    const payload = await verifier.verifyAsync(response.body.token);

    expect(payload).toEqual({
      sub: response.body.user.id,
      email: 'ana@marketplace.dev',
      role: 'seller',
      iat: expect.any(Number),
      exp: expect.any(Number),
    });
    expect(payload.exp - payload.iat).toBe(86_400);
  });

  it('finds the user when the email has spaces and capitals', async () => {
    await login(makeLoginBody({ email: '  ANA@Marketplace.dev ' })).expect(200);
  });

  it('answers the same 401 to an unknown email and to a wrong password', async () => {
    const unknownEmail = await login(
      makeLoginBody({ email: 'nobody@marketplace.dev' })
    ).expect(401);
    const wrongPassword = await login(
      makeLoginBody({ password: 'wrong-password' })
    ).expect(401);

    expect(unknownEmail.body.message).toBe('Credenciais inválidas');
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });

  it('answers "Conta inativa" to an inactive account with the right password', async () => {
    await users.update(
      { email: 'ana@marketplace.dev' },
      { status: UserStatus.INACTIVE }
    );

    const response = await login(makeLoginBody()).expect(401);

    expect(response.body.message).toBe('Conta inativa');
    expect(response.body).not.toHaveProperty('token');
  });

  it('answers "Credenciais inválidas" to an inactive account with a wrong password', async () => {
    await users.update(
      { email: 'ana@marketplace.dev' },
      { status: UserStatus.INACTIVE }
    );

    const response = await login(
      makeLoginBody({ password: 'wrong-password' })
    ).expect(401);

    expect(response.body.message).toBe('Credenciais inválidas');
  });

  it.each([
    ['email', { email: undefined }],
    ['email', { email: 'not-an-email' }],
    ['email', { email: 'a\ud800@marketplace.dev' }],
    ['password', { password: undefined }],
    ['password', { password: '12345' }],
    ['password', { password: 'é'.repeat(37) }],
    ['password', { password: 123456 }],
    ['role', { role: 'seller' }],
  ])('answers 400 naming %s (%o)', async (field, overrides) => {
    const response = await login(makeLoginBody(overrides)).expect(400);

    expect(response.body.message).toEqual(
      expect.arrayContaining([expect.stringContaining(field)])
    );
  });

  it('answers 400 to a malformed JSON body', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":')
      .expect(400);
  });
});

describe('POST /auth/login rate limit (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await startApp(await makeModuleRef());
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers 429 once its own limit is spent, without touching registration or the probes', async () => {
    const server = app.getHttpServer();

    // Invalid bodies still count: the guard runs before validation.
    for (let i = 0; i < LOGIN_THROTTLE.limit; i++) {
      await request(server).post('/auth/login').send({}).expect(400);
    }

    await request(server).post('/auth/login').send(makeLoginBody()).expect(429);
    await request(server).post('/auth/register').send({}).expect(400);
    await request(server).get('/health/live').expect(200);
  });
});
