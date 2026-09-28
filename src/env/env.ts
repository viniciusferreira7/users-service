import { LogLevel } from '@viniciusferreira7/signals';
import { z } from 'zod';

const LOG_LEVELS: LogLevel[] = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
] as const;

// `z.coerce.number()` alone turns an empty value into 0, and port 0 makes the
// server listen on a random port without complaining.
const port = z.coerce.number().int().min(1).max(65_535);

export const envSchema = z.object({
  NODE_ENV: z.enum(['dev', 'test', 'production']).default('dev'),
  PORT: port.default(3334),
  SHUTDOWN_DRAIN_DELAY_MS: z.coerce.number().int().min(0).default(10_000),

  DATABASE_URL: z.url(),
  DATABASE_PORT: port.default(5435),
  DATABASE_USERNAME: z.string().min(1),
  DATABASE_PASSWORD: z.string().min(1),
  DATABASE_NAME: z.string().min(1),

  OTEL_SERVICE_NAME: z.string().min(1),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url(),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),

  // Signs the tokens `POST /auth/login` issues. The api-gateway verifies them
  // with its own copy, so both services must share this exact value.
  JWT_SECRET: z.string().min(32),

  // Browser origins allowed to call this service, comma-separated. The
  // wildcard is refused on purpose: every origin is named. Server-to-server
  // calls (the api-gateway) are not subject to CORS at all.
  CORS_ORIGIN: z
    .string()
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    )
    .pipe(z.array(z.url({ protocol: /^https?$/ })).min(1)),
});

export type Env = z.infer<typeof envSchema>;
