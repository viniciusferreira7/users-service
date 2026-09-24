import type { ThrottlerOptions } from '@nestjs/throttler';

/**
 * Per-route limits for the auth endpoints. Every request comes through the
 * api-gateway, so `req.ip` is the gateway's address: these cap the service as
 * a whole, while the per-client limits live in the gateway. X-Forwarded-For is
 * deliberately not trusted here. Counters are kept per route (the throttler
 * key includes the handler), so exhausting one never blocks the other.
 */
const MINUTE = 60_000;

export const REGISTER_THROTTLE = { ttl: MINUTE, limit: 30 };
export const LOGIN_THROTTLE = { ttl: MINUTE, limit: 60 };

/**
 * Module-wide fallback — the strictest limit — for a guarded route that
 * forgets its own `@Throttle`. Every route should declare one.
 */
export const DEFAULT_THROTTLE = {
  name: 'default',
  ...REGISTER_THROTTLE,
} satisfies ThrottlerOptions;
