import { ConflictException, Injectable } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { UserResponseDto } from '../users/dtos/user-response.dto';
import { UserStatus } from '../users/enums/user-status.enum';
import { UsersService } from '../users/users.service';
import { isUniqueViolation } from '../utils/is-unique-violation';
import type { RegisterDto } from './dtos/register.dto';
import { normalizeEmail } from './normalize-email';

export const PASSWORD_SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async register(dto: RegisterDto): Promise<UserResponseDto> {
    const email = normalizeEmail(dto.email);

    if (await this.usersService.findByEmail(email)) {
      throw emailAlreadyRegistered();
    }

    const password = await hash(dto.password, PASSWORD_SALT_ROUNDS);

    try {
      const user = await this.usersService.create({
        email,
        password,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        status: UserStatus.ACTIVE,
      });

      return UserResponseDto.from(user);
    } catch (error) {
      // A concurrent registration can pass the lookup above too; the unique
      // index on email is what finally rejects it.
      if (isUniqueViolation(error)) {
        throw emailAlreadyRegistered();
      }

      throw error;
    }
  }
}

function emailAlreadyRegistered() {
  return new ConflictException('Email is already registered');
}
