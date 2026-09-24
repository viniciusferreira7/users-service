import { ConflictException } from '@nestjs/common';
import { compare, getRounds } from 'bcryptjs';
import { QueryFailedError } from 'typeorm';
import type { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { UserStatus } from '../users/enums/user-status.enum';
import type { CreateUserData, UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import type { RegisterDto } from './dtos/register.dto';

const dto: RegisterDto = {
  email: 'ana@marketplace.dev',
  password: 'secret123',
  firstName: 'Ana',
  lastName: 'Souza',
  role: UserRole.BUYER,
};

function makeUsersService() {
  return {
    findByEmail: vi.fn(async (_email: string): Promise<User | null> => null),
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
  return {
    usersService,
    authService: new AuthService(usersService as unknown as UsersService),
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
