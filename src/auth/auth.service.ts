import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash } from 'bcryptjs';
import { UserResponseDto } from '../users/dtos/user-response.dto';
import type { UserRole } from '../users/enums/user-role.enum';
import { UserStatus } from '../users/enums/user-status.enum';
import { UsersService } from '../users/users.service';
import { isUniqueViolation } from '../utils/is-unique-violation';
import type { LoginDto } from './dtos/login.dto';
import type { LoginResponseDto } from './dtos/login-response.dto';
import type { RegisterDto } from './dtos/register.dto';
import { ValidateTokenResponseDto } from './dtos/validate-token-response.dto';
import { normalizeEmail } from './normalize-email';
import { PASSWORD_SALT_ROUNDS, verifyPassword } from './password';

export const INVALID_CREDENTIALS = 'Credenciais inválidas';
export const INACTIVE_ACCOUNT = 'Conta inativa';

export type TokenPayload = { sub: string; email: string; role: UserRole };

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService
  ) {}

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

  /**
   * The JWT guard already checked signature and expiry; this is the part a
   * token cannot answer on its own — whether the account still exists and is
   * allowed in.
   */
  async validateToken(userId: string): Promise<ValidateTokenResponseDto> {
    const user = await this.usersService.findById(userId);

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException();
    }

    return ValidateTokenResponseDto.from(user);
  }

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.usersService.findByEmailWithPassword(
      normalizeEmail(dto.email)
    );

    // Runs even when the user is missing, so an unknown email and a wrong
    // password take the same time and get the same answer.
    const passwordMatches = await verifyPassword(dto.password, user?.password);

    if (!user || !passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    // Checked only after the password, so the status is never revealed to a
    // caller who merely guessed a registered email.
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(INACTIVE_ACCOUNT);
    }

    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      user: UserResponseDto.from(user),
      token: await this.jwtService.signAsync(payload),
    };
  }
}

function emailAlreadyRegistered() {
  return new ConflictException('Email is already registered');
}
