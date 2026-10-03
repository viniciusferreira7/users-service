import {
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash } from 'bcryptjs';
import { metrics } from '../observability/metrics';
import { UserResponseDto } from '../users/dtos/user-response.dto';
import type { User } from '../users/entities/user.entity';
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

type AuthOperation = 'register' | 'login' | 'validate_token';

type AuthOutcome =
  | 'succeeded'
  | 'email_taken'
  | 'invalid_credentials'
  | 'inactive_account'
  | 'rejected'
  | 'failed';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService
  ) {}

  /**
   * Records how one operation ended, once. Attributes are a closed set: the
   * user id belongs in the log line, and the email in neither.
   */
  private settle(
    operation: AuthOperation,
    outcome: AuthOutcome,
    startedAt: number
  ): void {
    metrics.auth_operations.add(1, { operation, outcome });
    metrics.auth_operation_duration.record(Date.now() - startedAt, {
      operation,
      outcome,
    });
  }

  /**
   * A domain refusal (an HttpException) was already settled where it was
   * thrown; anything else is unexpected, settled as `failed` and rethrown
   * untouched so the HTTP answer does not change.
   */
  private settleUnexpected(
    operation: AuthOperation,
    error: unknown,
    startedAt: number
  ): void {
    if (error instanceof HttpException) {
      return;
    }

    this.settle(operation, 'failed', startedAt);
    this.logger.error(
      `${operation} failed unexpectedly`,
      error instanceof Error ? error.stack : undefined
    );
  }

  private emailTaken(startedAt: number): ConflictException {
    this.settle('register', 'email_taken', startedAt);
    this.logger.warn('Registration refused: email already registered');

    return emailAlreadyRegistered();
  }

  async register(dto: RegisterDto): Promise<UserResponseDto> {
    const startedAt = Date.now();

    try {
      const email = normalizeEmail(dto.email);

      if (await this.usersService.findByEmail(email)) {
        throw this.emailTaken(startedAt);
      }

      const password = await hash(dto.password, PASSWORD_SALT_ROUNDS);

      let user: User;

      try {
        user = await this.usersService.create({
          email,
          password,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: dto.role,
          status: UserStatus.ACTIVE,
        });
      } catch (error) {
        // A concurrent registration can pass the lookup above too; the unique
        // index on email is what finally rejects it.
        if (isUniqueViolation(error)) {
          throw this.emailTaken(startedAt);
        }

        throw error;
      }

      this.settle('register', 'succeeded', startedAt);
      this.logger.log(`Registered user ${user.id} as ${user.role}`);

      return UserResponseDto.from(user);
    } catch (error) {
      this.settleUnexpected('register', error, startedAt);

      throw error;
    }
  }

  /**
   * The JWT guard already checked signature and expiry; this is the part a
   * token cannot answer on its own — whether the account still exists and is
   * allowed in.
   */
  async validateToken(userId: string): Promise<ValidateTokenResponseDto> {
    const startedAt = Date.now();

    try {
      const user = await this.usersService.findById(userId);

      if (!user || user.status !== UserStatus.ACTIVE) {
        this.settle('validate_token', 'rejected', startedAt);
        this.logger.warn(
          `Token refused: user ${userId} is missing or inactive`
        );

        throw new UnauthorizedException();
      }

      this.settle('validate_token', 'succeeded', startedAt);

      return ValidateTokenResponseDto.from(user);
    } catch (error) {
      this.settleUnexpected('validate_token', error, startedAt);

      throw error;
    }
  }

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const startedAt = Date.now();

    try {
      const user = await this.usersService.findByEmailWithPassword(
        normalizeEmail(dto.email)
      );

      // Runs even when the user is missing, so an unknown email and a wrong
      // password take the same time and get the same answer.
      const passwordMatches = await verifyPassword(
        dto.password,
        user?.password
      );

      if (!user || !passwordMatches) {
        this.settle('login', 'invalid_credentials', startedAt);
        // The email is never logged: it is personal data, and on a failed
        // login it is exactly what an attacker is probing.
        this.logger.warn(
          user
            ? `Login refused for user ${user.id}: wrong password`
            : 'Login refused: no account for the given email'
        );

        throw new UnauthorizedException(INVALID_CREDENTIALS);
      }

      // Checked only after the password, so the status is never revealed to a
      // caller who merely guessed a registered email.
      if (user.status !== UserStatus.ACTIVE) {
        this.settle('login', 'inactive_account', startedAt);
        this.logger.warn(`Login refused for user ${user.id}: inactive account`);

        throw new UnauthorizedException(INACTIVE_ACCOUNT);
      }

      const payload: TokenPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
      };

      const token = await this.jwtService.signAsync(payload);

      this.settle('login', 'succeeded', startedAt);
      this.logger.log(`User ${user.id} logged in`);

      return { user: UserResponseDto.from(user), token };
    } catch (error) {
      this.settleUnexpected('login', error, startedAt);

      throw error;
    }
  }
}

function emailAlreadyRegistered() {
  return new ConflictException('Email is already registered');
}
