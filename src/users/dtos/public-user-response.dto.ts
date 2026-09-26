import { ApiProperty } from '@nestjs/swagger';
import type { User } from '../entities/user.entity';
import { UserRole } from '../enums/user-role.enum';
import { UserStatus } from '../enums/user-status.enum';

/**
 * A user as any logged-in user may see them. Leaves out the email as well as
 * the password, so looking someone up never harvests contact data; the owner
 * reads their own account through `UserResponseDto`.
 */
export class PublicUserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Ana' })
  firstName: string;

  @ApiProperty({ example: 'Souza' })
  lastName: string;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiProperty({ enum: UserStatus })
  status: UserStatus;

  static from(user: User): PublicUserResponseDto {
    const dto = new PublicUserResponseDto();

    dto.id = user.id;
    dto.firstName = user.firstName;
    dto.lastName = user.lastName;
    dto.role = user.role;
    dto.status = user.status;

    return dto;
  }
}
