import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, getRounds, hashSync } from 'bcryptjs';
import { QueryFailedError } from 'typeorm';
import { metrics } from '../observability/metrics';
import type { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { UserStatus } from '../users/enums/user-status.enum';
import type { CreateUserData, UsersService } from '../users/users.service';
import {
  AuthService,
  INACTIVE_ACCOUNT,
  INVALID_CREDENTIALS,
  type TokenPayload,
} from './auth.service';
import type { RegisterDto } from './dtos/register.dto';
import { jwtOptions } from './jwt-options';
import { verifyPassword } from './password';

// Passthrough spy: the real comparison runs, and the tests can still see
// that `login` asked for it.
vi.mock('./password', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./password')>();

  return { ...actual, verifyPassword: vi.fn(actual.verifyPassword) };
});

const dto: RegisterDto = {
  email: 'ana@marketplace.dev',
  password: 'secret123',
  firstName: 'Ana',
  lastName: 'Souza',
  role: UserRole.BUYER,
};

const JWT_SECRET = 'unit-test-jwt-secret-with-32-chars!';

const storedUser: User = {
  id: 'user-1',
  email: 'ana@marketplace.dev',
  password: hashSync('secret123', 4),
  firstName: 'Ana',
  lastName: 'Souza',
  role: UserRole.SELLER,
  status: UserStatus.ACTIVE,
  createdAt: new Date('2026-09-24T12:00:00.000Z'),
  updatedAt: new Date('2026-09-24T12:00:00.000Z'),
};

function makeUsersService() {
  return {
    findById: vi.fn(async (_id: string): Promise<User | null> => storedUser),
    findByEmail: vi.fn(async (_email: string): Promise<User | null> => null),
    findByEmailWithPassword: vi.fn(
      async (_email: string): Promise<User | null> => storedUser
    ),
    create: vi.fn(
      async (data: CreateUserData): Promise<User> => ({
        ...data,
        id: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    ),
  };
}

function makeAuthService(usersService = makeUsersService()) {
  const jwtService = new JwtService(jwtOptions(JWT_SECRET));

  return {
    usersService,
    jwtService,
    authService: new AuthService(
      usersService as unknown as UsersService,
      jwtService
    ),
  };
}

function uniqueViolation() {
  return new QueryFailedError(
    'INSERT ...',
    [],
    Object.assign(new Error(), { code: '23505' })
  );
}

describe('AuthService.register', () => {
  it('normalizes the email before looking it up and saving it', async () => {
    const { authService, usersService } = makeAuthService();

    await authService.register({ ...dto, email: '  Ana@Marketplace.DEV ' });

    expect(usersService.findByEmail).toHaveBeenCalledWith(
      'ana@marketplace.dev'
    );
    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ana@marketplace.dev' })
    );
  });

  it('refuses an email that is already registered without saving', async () => {
    const { authService, usersService } = makeAuthService();
    usersService.findByEmail.mockResolvedValue({ id: 'existing' } as User);

    await expect(authService.register(dto)).rejects.toThrow(
      new ConflictException('Email is already registered')
    );
    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('stores a bcrypt hash with 10 rounds instead of the password', async () => {
    const { authService, usersService } = makeAuthService();

    await authService.register(dto);

    const { password } = usersService.create.mock.calls[0][0];
    expect(password).not.toBe(dto.password);
    expect(getRounds(password)).toBe(10);
    await expect(compare(dto.password, password)).resolves.toBe(true);
  });

  it('always creates the user as active', async () => {
    const { authService, usersService } = makeAuthService();

    await authService.register(dto);

    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: UserStatus.ACTIVE })
    );
  });

  it('turns a unique violation from a concurrent registration into a conflict', async () => {
    const { authService, usersService } = makeAuthService();
    usersService.create.mockRejectedValue(uniqueViolation());

    await expect(authService.register(dto)).rejects.toThrow(
      new ConflictException('Email is already registered')
    );
  });

  it('lets any other failure propagate unchanged', async () => {
    const { authService, usersService } = makeAuthService();
    const failure = new Error('connection lost');
    usersService.create.mockRejectedValue(failure);

    await expect(authService.register(dto)).rejects.toBe(failure);
  });

  it('returns the public fields and never the password', async () => {
    const { authService } = makeAuthService();

    const result = await authService.register(dto);

    expect(result).toMatchObject({
      id: 'user-1',
      email: 'ana@marketplace.dev',
      firstName: 'Ana',
      lastName: 'Souza',
      role: UserRole.BUYER,
      status: UserStatus.ACTIVE,
    });
    expect(result).not.toHaveProperty('password');
  });
});

describe('AuthService.login', () => {
  const credentials = { email: 'ana@marketplace.dev', password: 'secret123' };

  it('returns the public user and a token for valid credentials', async () => {
    const { authService } = makeAuthService();

    const result = await authService.login(credentials);

    expect(result.user).toMatchObject({
      id: 'user-1',
      email: 'ana@marketplace.dev',
      role: UserRole.SELLER,
      status: UserStatus.ACTIVE,
    });
    expect(result.user).not.toHaveProperty('password');
    expect(result.token).toEqual(expect.any(String));
  });

  it('signs an HS256 token carrying only sub, email and role for 24 hours', async () => {
    const { authService, jwtService } = makeAuthService();

    const { token } = await authService.login(credentials);

    const payload = await jwtService.verifyAsync<
      TokenPayload & { iat: number; exp: number }
    >(token);
    expect(payload).toMatchObject({
      sub: 'user-1',
      email: 'ana@marketplace.dev',
      role: UserRole.SELLER,
    });
    expect(Object.keys(payload).sort()).toEqual([
      'email',
      'exp',
      'iat',
      'role',
      'sub',
    ]);
    expect(payload.exp - payload.iat).toBe(24 * 60 * 60);
    expect(jwtService.decode(token, { complete: true }).header.alg).toBe(
      'HS256'
    );
  });

  it('normalizes the email before looking the user up', async () => {
    const { authService, usersService } = makeAuthService();

    await authService.login({
      ...credentials,
      email: '  ANA@Marketplace.dev ',
    });

    expect(usersService.findByEmailWithPassword).toHaveBeenCalledWith(
      'ana@marketplace.dev'
    );
  });

  it('refuses an unknown email with the generic message', async () => {
    const { authService, usersService } = makeAuthService();
    usersService.findByEmailWithPassword.mockResolvedValue(null);

    await expect(authService.login(credentials)).rejects.toThrow(
      new UnauthorizedException(INVALID_CREDENTIALS)
    );
  });

  it('still runs the password comparison for an unknown email', async () => {
    const { authService, usersService } = makeAuthService();
    usersService.findByEmailWithPassword.mockResolvedValue(null);
    vi.mocked(verifyPassword).mockClear();

    await authService.login(credentials).catch(() => undefined);

    // Without it an unknown email answers in ~1 ms against ~50 ms for a wrong
    // password, and the timing tells which emails are registered.
    expect(verifyPassword).toHaveBeenCalledExactlyOnceWith(
      'secret123',
      undefined
    );
  });

  it('refuses a wrong password with the same generic message', async () => {
    const { authService } = makeAuthService();

    await expect(
      authService.login({ ...credentials, password: 'wrong-password' })
    ).rejects.toThrow(new UnauthorizedException(INVALID_CREDENTIALS));
  });

  it('tells an inactive account apart only when the password is right', async () => {
    const { authService, usersService } = makeAuthService();
    usersService.findByEmailWithPassword.mockResolvedValue({
      ...storedUser,
      status: UserStatus.INACTIVE,
    });

    await expect(authService.login(credentials)).rejects.toThrow(
      new UnauthorizedException(INACTIVE_ACCOUNT)
    );
  });

  it('answers the generic message to an inactive account with a wrong password', async () => {
    const { authService, usersService } = makeAuthService();
    usersService.findByEmailWithPassword.mockResolvedValue({
      ...storedUser,
      status: UserStatus.INACTIVE,
    });

    await expect(
      authService.login({ ...credentials, password: 'wrong-password' })
    ).rejects.toThrow(new UnauthorizedException(INVALID_CREDENTIALS));
  });
});

describe('AuthService.validateToken', () => {
  it('answers the id, email and role read from the database', async () => {
    const { authService, usersService } = makeAuthService();

    await expect(authService.validateToken('user-1')).resolves.toEqual({
      userId: 'user-1',
      email: 'ana@marketplace.dev',
      role: UserRole.SELLER,
    });
    expect(usersService.findById).toHaveBeenCalledWith('user-1');
  });

  it('refuses a token whose user no longer exists', async () => {
    const { authService, usersService } = makeAuthService();
    usersService.findById.mockResolvedValue(null);

    await expect(authService.validateToken('user-1')).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it('refuses a token whose user was deactivated', async () => {
    const { authService, usersService } = makeAuthService();
    usersService.findById.mockResolvedValue({
      ...storedUser,
      status: UserStatus.INACTIVE,
    });

    await expect(authService.validateToken('user-1')).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });
});

describe('AuthService metrics', () => {
  let operations: ReturnType<typeof vi.spyOn>;
  let duration: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // No meter provider under test: every counter is the same no-op object,
    // so the attributes — not the call count — are what the tests check.
    operations = vi.spyOn(metrics.auth_operations, 'add');
    duration = vi.spyOn(metrics.auth_operation_duration, 'record');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const settledWith = (operation: string, outcome: string) => {
    expect(operations).toHaveBeenCalledWith(1, { operation, outcome });
    expect(duration).toHaveBeenCalledWith(expect.any(Number), {
      operation,
      outcome,
    });
  };

  it('counts a registration', async () => {
    const { authService } = makeAuthService();

    await authService.register(dto);

    settledWith('register', 'succeeded');
  });

  it('counts a registered email as email_taken', async () => {
    const { authService, usersService } = makeAuthService();
    usersService.findByEmail.mockResolvedValue(storedUser);

    await expect(authService.register(dto)).rejects.toBeInstanceOf(
      ConflictException
    );

    settledWith('register', 'email_taken');
  });

  it('counts a concurrent duplicate as email_taken', async () => {
    const { authService, usersService } = makeAuthService();
    usersService.create.mockRejectedValue(uniqueViolation());

    await expect(authService.register(dto)).rejects.toBeInstanceOf(
      ConflictException
    );

    settledWith('register', 'email_taken');
  });

  it('counts an unexpected registration error as failed and rethrows it', async () => {
    const { authService, usersService } = makeAuthService();
    const failure = new Error('connection lost');
    usersService.create.mockRejectedValue(failure);

    await expect(authService.register(dto)).rejects.toBe(failure);

    settledWith('register', 'failed');
  });

  it('records a domain refusal once, never also as failed', async () => {
    const { authService, usersService } = makeAuthService();
    usersService.findByEmail.mockResolvedValue(storedUser);

    await expect(authService.register(dto)).rejects.toThrow();

    expect(operations).toHaveBeenCalledTimes(1);
  });

  it('counts a login', async () => {
    const { authService } = makeAuthService();

    await authService.login({ email: dto.email, password: 'secret123' });

    settledWith('login', 'succeeded');
  });

  it.each([
    ['an unknown email', null, 'secret123'],
    ['a wrong password', storedUser, 'wrong-password'],
  ])('counts %s as invalid_credentials', async (_case, user, password) => {
    const { authService, usersService } = makeAuthService();
    usersService.findByEmailWithPassword.mockResolvedValue(user);

    await expect(
      authService.login({ email: dto.email, password })
    ).rejects.toThrow(INVALID_CREDENTIALS);

    settledWith('login', 'invalid_credentials');
  });

  it('counts an inactive account with the right password as inactive_account', async () => {
    const { authService, usersService } = makeAuthService();
    usersService.findByEmailWithPassword.mockResolvedValue({
      ...storedUser,
      status: UserStatus.INACTIVE,
    });

    await expect(
      authService.login({ email: dto.email, password: 'secret123' })
    ).rejects.toThrow(INACTIVE_ACCOUNT);

    settledWith('login', 'inactive_account');
  });

  it('counts an unexpected login error as failed and rethrows it', async () => {
    const { authService, usersService } = makeAuthService();
    const failure = new Error('connection lost');
    usersService.findByEmailWithPassword.mockRejectedValue(failure);

    await expect(
      authService.login({ email: dto.email, password: 'secret123' })
    ).rejects.toBe(failure);

    settledWith('login', 'failed');
  });

  it('counts a valid token check', async () => {
    const { authService } = makeAuthService();

    await authService.validateToken(storedUser.id);

    settledWith('validate_token', 'succeeded');
  });

  it('counts a token of a missing or inactive account as rejected', async () => {
    const { authService, usersService } = makeAuthService();
    usersService.findById.mockResolvedValue(null);

    await expect(
      authService.validateToken(storedUser.id)
    ).rejects.toBeInstanceOf(UnauthorizedException);

    settledWith('validate_token', 'rejected');
  });

  it('counts an unexpected token check error as failed and rethrows it', async () => {
    const { authService, usersService } = makeAuthService();
    const failure = new Error('connection lost');
    usersService.findById.mockRejectedValue(failure);

    await expect(authService.validateToken(storedUser.id)).rejects.toBe(
      failure
    );

    settledWith('validate_token', 'failed');
  });

  it('carries only closed-set attributes', async () => {
    const { authService } = makeAuthService();

    await authService.login({ email: dto.email, password: 'secret123' });

    // An email or a user id as an attribute mints a series per person.
    for (const [, attributes] of operations.mock.calls) {
      expect(Object.keys(attributes as object).sort()).toEqual([
        'operation',
        'outcome',
      ]);
      expect(JSON.stringify(attributes)).not.toContain(dto.email);
    }
  });
});
