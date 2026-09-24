import type { JwtModuleOptions } from '@nestjs/jwt';

export const TOKEN_TTL = '24h';

/**
 * HS256 is pinned on both ends — the api-gateway verifies these tokens with
 * the same shared secret and the same algorithm.
 */
export function jwtOptions(secret: string): JwtModuleOptions {
  return {
    secret,
    signOptions: { algorithm: 'HS256', expiresIn: TOKEN_TTL },
    verifyOptions: { algorithms: ['HS256'] },
  };
}
