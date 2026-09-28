import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { makeModuleRef, startApp } from './factories/make-module-ref';

// `test/setup-env.ts` allows only the api-gateway origin.
const ALLOWED = 'http://localhost:3333';

describe('CORS allowlist (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await startApp(await makeModuleRef());
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers a preflight from an allowed origin', async () => {
    const response = await request(app.getHttpServer())
      .options('/health')
      .set('Origin', ALLOWED)
      .set('Access-Control-Request-Method', 'GET');

    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED);
  });

  it('does not allow any other origin', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'https://evil.example');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
