/**
 * Environment defaults for the lanes that boot the Nest application
 * (integration and e2e). `.env.test` is gitignored, so without this a fresh
 * clone or a CI run would fail the Zod validation in `src/env/env.ts`.
 *
 * These are throwaway values — never put real credentials here. Anything
 * already present in `process.env` wins, so CI can override any of them.
 */
const defaults: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: '3334',
  // Port 5436 is what `docker-compose.yaml` publishes for the test Postgres
  // (`${DATABASE_TEST_PORT:-5436}`) — the dev one owns 5435.
  DATABASE_URL: 'postgres://test:test@localhost:5436/users_db_test',
  DATABASE_PORT: '5436',
  DATABASE_USERNAME: 'test',
  DATABASE_PASSWORD: 'test',
  DATABASE_NAME: 'users_db_test',
  // Throwaway signing key for the int/e2e lanes (the schema needs >= 32 chars).
  JWT_SECRET: 'test-only-jwt-secret-never-use-in-real-life',
  CORS_ORIGIN: 'http://localhost:3333',
  // `NODE_ENV=test` disables the signals SDK, so nothing is exported. These
  // only exist to satisfy the Zod schema.
  OTEL_SERVICE_NAME: 'users-service',
  OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
};

for (const [key, value] of Object.entries(defaults)) {
  process.env[key] ??= value;
}
