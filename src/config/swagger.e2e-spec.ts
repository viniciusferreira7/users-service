import type { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import request from 'supertest';
import { readOpenApiDocument } from 'test/config/openapi';
import { makeModuleRef, startApp } from 'test/factories/make-module-ref';
import { SWAGGER_PATH, setupSwagger } from './swagger.config';

describe('Swagger (e2e)', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    app = await startApp(await makeModuleRef(), {
      beforeInit: async (nestApp) => {
        setupSwagger(nestApp);
      },
    });

    document = await readOpenApiDocument(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the Swagger UI', async () => {
    const response = await request(app.getHttpServer())
      .get(`/${SWAGGER_PATH}`)
      .expect(200);

    expect(response.text).toContain('swagger-ui');
  });

  it('describes the service', () => {
    expect(document.info.title).toBe('Marketplace Users Service');
  });

  it('documents every route the application exposes', () => {
    expect(Object.keys(document.paths).sort()).toEqual([
      '/',
      '/auth/login',
      '/auth/register',
      '/health/live',
      '/health/ready',
      '/health/startup',
    ]);
  });

  it('groups the probes and the greeting under Health', () => {
    const getPaths = Object.keys(document.paths).filter(
      (path) => document.paths[path].get
    );

    for (const path of getPaths) {
      expect(document.paths[path].get?.tags).toEqual(['Health']);
      expect(document.paths[path].get?.summary).toBeTruthy();
    }
  });

  it('documents the registration endpoint under Auth', () => {
    const operation = document.paths['/auth/register'].post;

    expect(operation?.tags).toEqual(['Auth']);
    expect(operation?.summary).toBeTruthy();
    expect(Object.keys(operation?.responses ?? {}).sort()).toEqual([
      '201',
      '400',
      '409',
      '429',
    ]);
  });

  it('documents the registration body and the public user shape', () => {
    const schemas = document.components?.schemas ?? {};

    expect(Object.keys(schemas)).toEqual(
      expect.arrayContaining(['RegisterDto', 'UserResponseDto'])
    );
    expect(JSON.stringify(schemas.UserResponseDto)).not.toContain('password');
  });
});
