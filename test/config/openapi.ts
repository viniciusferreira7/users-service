import type { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import request from 'supertest';
import { SWAGGER_PATH } from '@/config/swagger.config';

export async function readOpenApiDocument(
  app: INestApplication
): Promise<OpenAPIObject> {
  const response = await request(app.getHttpServer())
    .get(`/${SWAGGER_PATH}-json`)
    .expect(200);

  return response.body;
}
