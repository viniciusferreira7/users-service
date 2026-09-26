import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { makeLoginBody } from 'test/factories/make-login-body';
import { startApp } from 'test/factories/make-module-ref';
import { makeRegisterBody } from 'test/factories/make-register-body';
import {
  signTestToken,
  tamperPayload,
  unsignedToken,
} from 'test/factories/make-token';
import { TestRoutesModule } from 'test/factories/test-routes.module';
import { resetTestDatabase } from 'test/utils/reset-test-database';
import { DataSource } from 'typeorm';
import { AppModule } from '@/app.module';

const UNAUTHORIZED = { message: 'Unauthorized', statusCode: 401 };
const OTHER_SECRET = 'another-secret-that-is-at-least-32-chars';

describe('Global JWT guard (E2E)', () => {
  let app: INestApplication;
  let token: string;
  let user: { id: string; email: string; role: string };

  const whoAmI = (authorization?: string) => {
    const call = request(app.getHttpServer()).get('/test/protected');

    return authorization ? call.set('Authorization', authorization) : call;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, TestRoutesModule],
    })
      // Rate limits have their own specs; here they would only get in the way.
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    await resetTestDatabase(moduleRef.get(DataSource));
    app = await startApp(moduleRef);

    const server = app.getHttpServer();
    await request(server)
      .post('/auth/register')
      .send(makeRegisterBody({ role: 'seller' }))
      .expect(201);
    const login = await request(server)
      .post('/auth/login')
      .send(makeLoginBody())
      .expect(200);

    token = login.body.token;
    user = login.body.user;
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves a protected route to a valid token, with exactly { id, email, role } as req.user', async () => {
    const response = await whoAmI(`Bearer ${token}`).expect(200);

    expect(response.body).toEqual({
      id: user.id,
      email: 'ana@marketplace.dev',
      role: 'seller',
    });
  });

  const now = () => Math.floor(Date.now() / 1000);
  const claims = () => ({ sub: user.id, email: user.email, role: user.role });

  it.each<[string, () => string | undefined]>([
    ['no Authorization header', () => undefined],
    ['a Token scheme', () => `Token ${token}`],
    ['Bearer without a token', () => 'Bearer '],
    [
      'a token signed with another secret',
      () => `Bearer ${signTestToken(claims(), { secret: OTHER_SECRET })}`,
    ],
    [
      'a tampered payload',
      () => `Bearer ${tamperPayload(token, { role: 'buyer' })}`,
    ],
    [
      'an expired token',
      () =>
        `Bearer ${signTestToken({ ...claims(), iat: now() - 7200, exp: now() - 60 })}`,
    ],
    ['an alg none token', () => `Bearer ${unsignedToken(claims())}`],
    [
      'an HS512 token with the right secret',
      () => `Bearer ${signTestToken(claims(), { algorithm: 'HS512' })}`,
    ],
    [
      'a role outside seller and buyer',
      () => `Bearer ${signTestToken({ ...claims(), role: 'admin' })}`,
    ],
    [
      'no sub',
      () => `Bearer ${signTestToken({ email: user.email, role: user.role })}`,
    ],
  ])('answers the same 401 to %s', async (_case, authorization) => {
    const response = await whoAmI(authorization()).expect(401);

    expect(response.body).toEqual(UNAUTHORIZED);
  });

  it('keeps registration and login open without a token', async () => {
    const server = app.getHttpServer();

    await request(server)
      .post('/auth/register')
      .send(makeRegisterBody({ email: 'bia@marketplace.dev' }))
      .expect(201);
    await request(server)
      .post('/auth/login')
      .send(makeLoginBody({ email: 'bia@marketplace.dev' }))
      .expect(200);
  });

  it.each(['/', '/health/live', '/health/ready', '/health/startup'])(
    'keeps GET %s open without a token',
    async (path) => {
      await request(app.getHttpServer()).get(path).expect(200);
    }
  );

  it('ignores a bad token on a public route', async () => {
    await request(app.getHttpServer())
      .get('/health/live')
      .set('Authorization', 'Bearer not-a-token')
      .expect(200);
  });

  it('opens every route of a controller marked @Public()', async () => {
    await request(app.getHttpServer()).get('/test/public').expect(200);
  });
});
