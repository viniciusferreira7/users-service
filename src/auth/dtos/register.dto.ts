import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../users/enums/user-role.enum';
import { normalizeEmail } from '../normalize-email';
import {
  IsWellFormedEmail,
  MaxUtf8Bytes,
  STORABLE_TEXT,
} from './string-validators';

export const PASSWORD_MIN_LENGTH = 6;
/**
 * bcrypt ignores everything past 72 bytes, so a longer password would only
 * ever be checked by its prefix. Measured in bytes: accented characters and
 * emoji take more than one.
 */
export const PASSWORD_MAX_BYTES = 72;
export const NAME_MAX_LENGTH = 100;

/** At least one non-whitespace character. */
const NOT_BLANK = /\S/;

export class RegisterDto {
  @ApiProperty({ example: 'ana@marketplace.dev' })
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeEmail(value) : value
  )
  // `isEmail` rejects anything over 254 characters, which also keeps the
  // value inside the `varchar(255)` column.
  @IsWellFormedEmail()
  email: string;

  @ApiProperty({
    example: 'secret123',
    minLength: PASSWORD_MIN_LENGTH,
    description: `At most ${PASSWORD_MAX_BYTES} bytes`,
  })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxUtf8Bytes(PASSWORD_MAX_BYTES)
  password: string;

  @ApiProperty({ example: 'Ana', maxLength: NAME_MAX_LENGTH })
  @IsString()
  @IsNotEmpty()
  @Matches(NOT_BLANK, { message: 'firstName must not be blank' })
  @Matches(STORABLE_TEXT, {
    message: 'firstName must not contain control characters',
  })
  @MaxLength(NAME_MAX_LENGTH)
  firstName: string;

  @ApiProperty({ example: 'Souza', maxLength: NAME_MAX_LENGTH })
  @IsString()
  @IsNotEmpty()
  @Matches(NOT_BLANK, { message: 'lastName must not be blank' })
  @Matches(STORABLE_TEXT, {
    message: 'lastName must not contain control characters',
  })
  @MaxLength(NAME_MAX_LENGTH)
  lastName: string;

  @ApiProperty({ enum: UserRole, example: UserRole.BUYER })
  @IsEnum(UserRole)
  role: UserRole;
}
