import type { INestApplication } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { makeLoginBody } from 'test/factories/make-login-body';
import { makeModuleRef, startApp } from 'test/factories/make-module-ref';
import { makeRegisterBody } from 'test/factories/make-register-body';
import { tamperPayload } from 'test/factories/make-token';
import { resetTestDatabase } from 'test/utils/reset-test-database';
import { DataSource, type Repository } from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { UserStatus } from '@/users/enums/user-status.enum';

const UNAUTHORIZED = { message: 'Unauthorized', statusCode: 401 };

describe('GET /auth/validate-token (E2E)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  let token: string;
  let userId: string;

  const validate = (authorization?: string) => {
    const call = request(app.getHttpServer()).get('/auth/validate-token');

    return authorization ? call.set('Authorization', authorization) : call;
  };

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
  });

  beforeEach(async () => {
    await users.clear();
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(makeRegisterBody({ role: 'seller' }))
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send(makeLoginBody())
      .expect(200);

    token = login.body.token;
    userId = login.body.user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers who the token belongs to', async () => {
    const response = await validate(`Bearer ${token}`).expect(200);

    expect(response.body).toEqual({
      userId,
      email: 'ana@marketplace.dev',
      role: 'seller',
    });
  });

  it('refuses a request without a token', async () => {
    const response = await validate().expect(401);

    expect(response.body).toEqual(UNAUTHORIZED);
  });

  it('refuses a token whose payload was tampered with', async () => {
    await validate(`Bearer ${tamperPayload(token, { role: 'buyer' })}`).expect(
      401
    );
  });

  it('refuses a valid token once the account is deactivated', async () => {
    await users.update(userId, { status: UserStatus.INACTIVE });

    await validate(`Bearer ${token}`).expect(401);
  });

  it('refuses a valid token once the account is deleted', async () => {
    await users.delete(userId);

    await validate(`Bearer ${token}`).expect(401);
  });
});
