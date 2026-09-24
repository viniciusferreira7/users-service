import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsByteLength,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../users/enums/user-role.enum';
import { normalizeEmail } from '../normalize-email';

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
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'secret123',
    minLength: PASSWORD_MIN_LENGTH,
    description: `At most ${PASSWORD_MAX_BYTES} bytes`,
  })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @IsByteLength(0, PASSWORD_MAX_BYTES, {
    message: `password must be at most ${PASSWORD_MAX_BYTES} bytes long`,
  })
  password: string;

  @ApiProperty({ example: 'Ana', maxLength: NAME_MAX_LENGTH })
  @IsString()
  @IsNotEmpty()
  @Matches(NOT_BLANK, { message: 'firstName must not be blank' })
  @MaxLength(NAME_MAX_LENGTH)
  firstName: string;

  @ApiProperty({ example: 'Souza', maxLength: NAME_MAX_LENGTH })
  @IsString()
  @IsNotEmpty()
  @Matches(NOT_BLANK, { message: 'lastName must not be blank' })
  @MaxLength(NAME_MAX_LENGTH)
  lastName: string;

  @ApiProperty({ enum: UserRole, example: UserRole.BUYER })
  @IsEnum(UserRole)
  role: UserRole;
}
