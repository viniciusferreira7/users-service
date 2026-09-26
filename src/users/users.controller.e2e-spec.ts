import type { INestApplication } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { makeLoginBody } from 'test/factories/make-login-body';
import { makeModuleRef, startApp } from 'test/factories/make-module-ref';
import { makeRegisterBody } from 'test/factories/make-register-body';
import { signTestToken } from 'test/factories/make-token';
import { resetTestDatabase } from 'test/utils/reset-test-database';
import { DataSource, type Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserStatus } from './enums/user-status.enum';

const UNAUTHORIZED = { message: 'Unauthorized', statusCode: 401 };
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';
const PUBLIC_KEYS = ['firstName', 'id', 'lastName', 'role', 'status'];

describe('Users routes (E2E)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  let token: string;
  let ana: { id: string };

  const get = (path: string, authorization = `Bearer ${token}`) =>
    request(app.getHttpServer()).get(path).set('Authorization', authorization);

  const register = (overrides: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/auth/register')
      .send(makeRegisterBody(overrides))
      .expect(201);

  beforeAll(async () => {
    // Rate limits have their own specs; here they would only get in the way.
    const moduleRef = await makeModuleRef((builder) =>
      builder
        .overrideGuard(ThrottlerGuard)
        .useValue({ canActivate: () => true })
    );

    await resetTestDatabase(moduleRef.get(DataSource));
    app = await startApp(moduleRef);
    users = moduleRef.get(getRepositoryToken(User));

    await register({ role: 'seller', firstName: 'Ana' });
    await register({
      email: 'caio@marketplace.dev',
      role: 'seller',
      firstName: 'Caio',
    });
    await register({ email: 'bia@marketplace.dev', role: 'buyer' });
    const davi = await register({
      email: 'davi@marketplace.dev',
      role: 'seller',
      firstName: 'Davi',
    });
    await users.update(davi.body.id, { status: UserStatus.INACTIVE });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send(makeLoginBody())
      .expect(200);

    token = login.body.token;
    ana = login.body.user;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /users/profile', () => {
    it('answers the logged-in user in full, without the password', async () => {
      const response = await get('/users/profile').expect(200);

      expect(response.body).toEqual({
        id: ana.id,
        email: 'ana@marketplace.dev',
        firstName: 'Ana',
        lastName: 'Souza',
        role: 'seller',
        status: 'active',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('reads the account from the database, not from the token', async () => {
      await users.update(ana.id, { lastName: 'Lima' });

      const response = await get('/users/profile').expect(200);

      expect(response.body.lastName).toBe('Lima');
      await users.update(ana.id, { lastName: 'Souza' });
    });

    it('answers 401 when the token names an account that no longer exists', async () => {
      const ghost = signTestToken({
        sub: UNKNOWN_ID,
        email: 'ghost@marketplace.dev',
        role: 'buyer',
      });

      const response = await get('/users/profile', `Bearer ${ghost}`).expect(
        401
      );

      expect(response.body).toEqual(UNAUTHORIZED);
    });
  });

  describe('GET /users/sellers', () => {
    it('lists only active sellers, by name, without email or password', async () => {
      const response = await get('/users/sellers').expect(200);

      expect(
        response.body.map((seller: { firstName: string }) => seller.firstName)
      ).toEqual(['Ana', 'Caio']);
      for (const seller of response.body) {
        expect(Object.keys(seller).sort()).toEqual(PUBLIC_KEYS);
      }
    });
  });

  describe('GET /users/:id', () => {
    it('answers the user without email or password', async () => {
      const response = await get(`/users/${ana.id}`).expect(200);

      expect(response.body).toEqual({
        id: ana.id,
        firstName: 'Ana',
        lastName: 'Souza',
        role: 'seller',
        status: 'active',
      });
    });

    it('answers 404 for an id no user has', async () => {
      const response = await get(`/users/${UNKNOWN_ID}`).expect(404);

      expect(response.body).toEqual({
        message: 'User not found',
        error: 'Not Found',
        statusCode: 404,
      });
    });

    it('answers 400 for an id that is not a uuid', async () => {
      await get('/users/not-a-uuid').expect(400);
    });
  });

  it.each(['/users/profile', '/users/sellers', `/users/${UNKNOWN_ID}`])(
    'answers 401 to GET %s without a token',
    async (path) => {
      const response = await request(app.getHttpServer()).get(path).expect(401);

      expect(response.body).toEqual(UNAUTHORIZED);
    }
  );
});
