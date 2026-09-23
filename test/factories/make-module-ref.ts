import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  Test,
  type TestingModule,
  type TestingModuleBuilder,
} from '@nestjs/testing';
import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';

/**
 * Builds the application's DI container for the integration and e2e lanes.
 *
 * Postgres is *not* faked: these lanes run against the throwaway test
 * database from the compose `test` profile. Both lanes load
 * `test/setup-env.ts`, which supplies the environment the Zod schema in
 * `src/env/env.ts` requires.
 *
 * Pass `configure` to layer per-spec overrides on top of the defaults:
 *
 * ```ts
 * const moduleRef = await makeModuleRef((builder) =>
 *   builder.overrideProvider(AppService).useValue(stub)
 * );
 * ```
 */
export async function makeModuleRef(
  configure?: (builder: TestingModuleBuilder) => TestingModuleBuilder
): Promise<TestingModule> {
  let builder = Test.createTestingModule({ imports: [AppModule] });

  if (configure) {
    builder = configure(builder);
  }

  return builder.compile();
}

/**
 * Boots the compiled module as an HTTP application through the same
 * `configureApp` as `src/main.ts`.
 */
export async function startApp(
  moduleRef: TestingModule,
  options?: {
    beforeInit?: (app: NestExpressApplication) => Promise<void>;
  }
): Promise<INestApplication> {
  const app = moduleRef.createNestApplication<NestExpressApplication>();

  configureApp(app);

  if (options?.beforeInit) {
    await options.beforeInit(app);
  }

  await app.init();

  return app;
}
