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
      '/auth/validate-token',
      '/health',
      '/health/live',
      '/health/ready',
      '/health/startup',
      '/users/profile',
      '/users/sellers',
      '/users/{id}',
    ]);
  });

  it('groups the probes and the greeting under Health', () => {
    const getPaths = Object.keys(document.paths).filter(
      (path) =>
        document.paths[path].get &&
        !path.startsWith('/users') &&
        !path.startsWith('/auth')
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

  it('documents the login endpoint under Auth', () => {
    const operation = document.paths['/auth/login'].post;

    expect(operation?.tags).toEqual(['Auth']);
    expect(operation?.summary).toBeTruthy();
    expect(Object.keys(operation?.responses ?? {}).sort()).toEqual([
      '200',
      '400',
      '401',
      '429',
    ]);
  });

  it('documents the token validation endpoint under Auth behind the bearer token', () => {
    const operation = document.paths['/auth/validate-token'].get;

    expect(operation?.tags).toEqual(['Auth']);
    expect(operation?.summary).toBeTruthy();
    expect(operation?.security).toEqual([{ 'JWT-auth': [] }]);
    expect(Object.keys(operation?.responses ?? {}).sort()).toEqual([
      '200',
      '401',
    ]);
  });

  it('documents the login body and response', () => {
    const schemas = document.components?.schemas ?? {};

    expect(Object.keys(schemas)).toEqual(
      expect.arrayContaining(['LoginDto', 'LoginResponseDto'])
    );
  });

  it.each<[string, string[]]>([
    ['/users/profile', ['200', '401']],
    ['/users/sellers', ['200', '401']],
    ['/users/{id}', ['200', '400', '401', '404']],
  ])('documents GET %s under Users behind the bearer token', (path, codes) => {
    const operation = document.paths[path].get;

    expect(operation?.tags).toEqual(['Users']);
    expect(operation?.summary).toBeTruthy();
    expect(operation?.security).toEqual([{ 'JWT-auth': [] }]);
    expect(Object.keys(operation?.responses ?? {}).sort()).toEqual(codes);
  });

  it('documents the public user shape without email or password', () => {
    const schema = JSON.stringify(
      document.components?.schemas?.PublicUserResponseDto
    );

    expect(schema).toBeDefined();
    expect(schema).not.toContain('email');
    expect(schema).not.toContain('password');
  });
});
