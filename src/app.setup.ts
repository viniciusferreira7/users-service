import { type INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * Cross-cutting HTTP setup shared by `main.ts` and the e2e harness, so the
 * specs exercise exactly the CORS and validation behaviour production runs.
 */
export function configureApp(app: INestApplication): void {
  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  );
}
