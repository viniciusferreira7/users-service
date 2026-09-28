import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { envSchema } from './env';

const baseEnv = {
  DATABASE_URL: 'postgres://postgres:postgres@localhost:5435/users_db',
  DATABASE_USERNAME: 'postgres',
  DATABASE_PASSWORD: 'postgres',
  DATABASE_NAME: 'users_db',
  OTEL_SERVICE_NAME: 'users-service',
  OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
  JWT_SECRET: 'a'.repeat(32),
  CORS_ORIGIN: 'http://localhost:3333',
};

describe('envSchema', () => {
  it('applies the NODE_ENV, PORT, LOG_LEVEL and drain delay defaults', () => {
    const env = envSchema.parse(baseEnv);

    expect(env.NODE_ENV).toBe('dev');
    expect(env.PORT).toBe(3334);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.SHUTDOWN_DRAIN_DELAY_MS).toBe(10_000);
  });

  it('defaults DATABASE_PORT to the port docker compose publishes', () => {
    expect(envSchema.parse(baseEnv).DATABASE_PORT).toBe(5435);
  });

  it('coerces PORT from a string', () => {
    expect(envSchema.parse({ ...baseEnv, PORT: '4000' }).PORT).toBe(4000);
  });

  it('rejects a PORT that is not a number', () => {
    // Coercion turns "abc" into NaN; the schema must refuse it, not listen on NaN.
    expect(() => envSchema.parse({ ...baseEnv, PORT: 'abc' })).toThrow();
  });

  it.each([
    ['empty', ''],
    ['blank', ' '],
    ['zero', '0'],
    ['negative', '-5'],
    ['fractional', '3.5'],
    ['out of range', '65536'],
  ])('rejects a PORT that is %s', (_label, value) => {
    // An empty PORT used to coerce to 0 and make Nest listen on a random port.
    expect(() => envSchema.parse({ ...baseEnv, PORT: value })).toThrow();
  });

  it('rejects a DATABASE_PORT that is not a valid port', () => {
    expect(() => envSchema.parse({ ...baseEnv, DATABASE_PORT: '' })).toThrow();
    expect(() =>
      envSchema.parse({ ...baseEnv, DATABASE_PORT: '70000' })
    ).toThrow();
  });

  it('rejects a negative drain delay', () => {
    expect(() =>
      envSchema.parse({ ...baseEnv, SHUTDOWN_DRAIN_DELAY_MS: '-1' })
    ).toThrow();
  });

  it('rejects a missing DATABASE_URL', () => {
    const { DATABASE_URL: _omitted, ...withoutUrl } = baseEnv;

    expect(() => envSchema.parse(withoutUrl)).toThrow();
  });

  it('rejects a DATABASE_URL that is not a url', () => {
    expect(() =>
      envSchema.parse({ ...baseEnv, DATABASE_URL: 'not-a-url' })
    ).toThrow();
  });

  it('rejects an empty DATABASE_NAME', () => {
    expect(() => envSchema.parse({ ...baseEnv, DATABASE_NAME: '' })).toThrow();
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() =>
      envSchema.parse({ ...baseEnv, NODE_ENV: 'staging' })
    ).toThrow();
  });

  it('rejects an invalid OTEL_EXPORTER_OTLP_ENDPOINT', () => {
    expect(() =>
      envSchema.parse({ ...baseEnv, OTEL_EXPORTER_OTLP_ENDPOINT: 'nope' })
    ).toThrow();
  });

  it('rejects an unknown LOG_LEVEL', () => {
    expect(() =>
      envSchema.parse({ ...baseEnv, LOG_LEVEL: 'verbose' })
    ).toThrow();
  });

  it('rejects a missing JWT_SECRET', () => {
    const { JWT_SECRET: _, ...withoutSecret } = baseEnv;

    expect(() => envSchema.parse(withoutSecret)).toThrow();
  });

  it('rejects a JWT_SECRET shorter than 32 characters', () => {
    expect(() =>
      envSchema.parse({ ...baseEnv, JWT_SECRET: 'a'.repeat(31) })
    ).toThrow();
  });

  it('accepts a JWT_SECRET of exactly 32 characters', () => {
    expect(envSchema.parse(baseEnv).JWT_SECRET).toBe('a'.repeat(32));
  });

  it('refuses to boot on the JWT_SECRET placeholder from .env.example', () => {
    // `cp .env.example .env` must not start a service that signs tokens with
    // a publicly known key.
    const example = readFileSync('.env.example', 'utf8');
    const placeholder = example.match(/^JWT_SECRET=(.*)$/m)?.[1];

    expect(placeholder).toBeDefined();
    expect(() =>
      envSchema.parse({ ...baseEnv, JWT_SECRET: placeholder })
    ).toThrow();
  });

  describe('CORS_ORIGIN', () => {
    it('parses a comma-separated allowlist of origins', () => {
      const env = envSchema.parse({
        ...baseEnv,
        CORS_ORIGIN: 'http://localhost:3333, https://marketplace.dev',
      });

      expect(env.CORS_ORIGIN).toEqual([
        'http://localhost:3333',
        'https://marketplace.dev',
      ]);
    });

    it('is required', () => {
      const { CORS_ORIGIN: _omitted, ...without } = baseEnv;

      expect(() => envSchema.parse(without)).toThrow();
      expect(() => envSchema.parse({ ...baseEnv, CORS_ORIGIN: '' })).toThrow();
    });

    it('refuses the wildcard: the allowlist must name each origin', () => {
      expect(() => envSchema.parse({ ...baseEnv, CORS_ORIGIN: '*' })).toThrow();
      expect(() =>
        envSchema.parse({
          ...baseEnv,
          CORS_ORIGIN: 'http://localhost:3333,*',
        })
      ).toThrow();
    });

    it('rejects an entry that is not a url', () => {
      expect(() =>
        envSchema.parse({ ...baseEnv, CORS_ORIGIN: 'localhost:3333' })
      ).toThrow();
    });
  });
});
