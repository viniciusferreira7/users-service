import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { usersServiceDetails } from '@/utils/users-service-details';

export const SWAGGER_PATH = 'api/docs';

/**
 * Describes this service for the OpenAPI document.
 *
 * The description is written flush left on purpose: Swagger UI renders it as
 * markdown, so indented lines would come out as a code block.
 */
export function buildSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('Marketplace Users Service')
    .setDescription(
      [
        'User accounts for the Marketplace system.',
        '',
        'Responsibilities:',
        '- Owns the seller and buyer accounts',
        '- Stores credentials as password hashes only',
        '- Tracks whether an account is active or inactive',
        '',
        'Authentication:',
        '- Use a JWT Bearer token for protected routes',
      ].join('\n')
    )
    .setVersion(usersServiceDetails.version)
    .setContact(
      'Marketplace Team',
      'https://marketplace.com',
      'dev@marketplace.com'
    )
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth'
    )
    .addTag('Auth', 'Account registration')
    .addTag('Users', 'User account management endpoints')
    .addTag('Health', 'Health monitoring endpoints')
    .build();
}

/** Mounts Swagger UI at {@link SWAGGER_PATH}. */
export function setupSwagger(app: INestApplication): void {
  const document = SwaggerModule.createDocument(app, buildSwaggerConfig());

  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'Marketplace Users Service Documentation',
    customfavIcon: './favicon',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #3b82f6 }
    `,
  });
}
