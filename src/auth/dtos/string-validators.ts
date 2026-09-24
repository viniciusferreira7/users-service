import {
  buildMessage,
  isEmail,
  ValidateBy,
  type ValidationOptions,
} from 'class-validator';

/**
 * A lone UTF-16 surrogate. With the `u` flag a valid surrogate pair is a
 * single code point, so only unpaired halves match.
 */
const LONE_SURROGATE = /\p{Cs}/u;

/**
 * Text that Postgres can store and that encodes to UTF-8: no control
 * characters (NUL is rejected by Postgres with 22021) and no lone surrogates.
 */
export const STORABLE_TEXT = /^[^\p{Cc}\p{Cs}]*$/u;

function isWellFormed(value: string): boolean {
  return !LONE_SURROGATE.test(value);
}

/**
 * `@IsEmail` that answers false instead of throwing: validator.js runs
 * `encodeURI` inside `isEmail`, which throws `URIError` on a lone surrogate
 * and would turn client input into a 500.
 */
export function IsWellFormedEmail(
  validationOptions?: ValidationOptions
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isWellFormedEmail',
      validator: {
        validate: (value) =>
          typeof value === 'string' && isWellFormed(value) && isEmail(value),
        defaultMessage: buildMessage(
          (eachPrefix) => `${eachPrefix}$property must be an email`,
          validationOptions
        ),
      },
    },
    validationOptions
  );
}

/**
 * Caps the UTF-8 size of a string. Unlike `@IsByteLength`, it never throws on
 * a lone surrogate — it rejects it.
 */
export function MaxUtf8Bytes(
  max: number,
  validationOptions?: ValidationOptions
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'maxUtf8Bytes',
      constraints: [max],
      validator: {
        validate: (value) =>
          typeof value === 'string' &&
          isWellFormed(value) &&
          Buffer.byteLength(value, 'utf8') <= max,
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be valid text of at most $constraint1 bytes`,
          validationOptions
        ),
      },
    },
    validationOptions
  );
}
