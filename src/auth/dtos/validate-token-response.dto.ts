import { ApiProperty } from '@nestjs/swagger';
import type { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';

/** Who a still-valid token belongs to, read fresh from the database. */
export class ValidateTokenResponseDto {
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ example: 'ana@marketplace.dev' })
  email: string;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  static from(user: User): ValidateTokenResponseDto {
    const dto = new ValidateTokenResponseDto();

    dto.userId = user.id;
    dto.email = user.email;
    dto.role = user.role;

    return dto;
  }
}
