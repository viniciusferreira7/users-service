import { type INestApplication, ValidationPipe } from '@nestjs/common';

export type AppSetupOptions = {
  /** Browser origins allowed by CORS — never a wildcard. */
  corsOrigins: string[];
};

/**
 * Cross-cutting HTTP setup shared by `main.ts` and the e2e harness, so the
 * specs exercise exactly the CORS and validation behaviour production runs.
 */
export function configureApp(
  app: INestApplication,
  { corsOrigins }: AppSetupOptions
): void {
  app.enableCors({ origin: corsOrigins });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  );
}
