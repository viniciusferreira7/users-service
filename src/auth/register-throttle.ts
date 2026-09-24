import type { ThrottlerOptions } from '@nestjs/throttler';

/**
 * Caps `POST /auth/register` for the service as a whole. Every request comes
 * through the api-gateway, so `req.ip` is the gateway's address: the
 * per-client limit lives there, and X-Forwarded-For is deliberately not
 * trusted here.
 */
export const REGISTER_THROTTLE = {
  name: 'register',
  ttl: 60_000,
  limit: 30,
} satisfies ThrottlerOptions;
