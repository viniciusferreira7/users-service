import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';
import { normalizeEmail } from '../normalize-email';
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH } from './register.dto';
import { IsWellFormedEmail, MaxUtf8Bytes } from './string-validators';

export class LoginDto {
  @ApiProperty({ example: 'ana@marketplace.dev' })
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeEmail(value) : value
  )
  @IsWellFormedEmail()
  email: string;

  @ApiProperty({
    example: 'secret123',
    minLength: PASSWORD_MIN_LENGTH,
    description: `At most ${PASSWORD_MAX_BYTES} bytes`,
  })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  // Same cap as registration: bcrypt only reads the first 72 bytes, so a
  // longer password sharing that prefix would otherwise log in.
  @MaxUtf8Bytes(PASSWORD_MAX_BYTES)
  password: string;
}
