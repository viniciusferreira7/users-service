import type { User } from '../entities/user.entity';
import { UserRole } from '../enums/user-role.enum';
import { UserStatus } from '../enums/user-status.enum';
import { UserResponseDto } from './user-response.dto';

const createdAt = new Date('2026-09-24T12:00:00.000Z');

const user = {
  id: 'user-1',
  email: 'ana@marketplace.dev',
  password: '$2b$10$hash',
  firstName: 'Ana',
  lastName: 'Souza',
  role: UserRole.BUYER,
  status: UserStatus.ACTIVE,
  createdAt,
  updatedAt: createdAt,
} satisfies User;

describe('UserResponseDto.from', () => {
  it('copies exactly the public fields', () => {
    expect({ ...UserResponseDto.from(user) }).toEqual({
      id: 'user-1',
      email: 'ana@marketplace.dev',
      firstName: 'Ana',
      lastName: 'Souza',
      role: UserRole.BUYER,
      status: UserStatus.ACTIVE,
      createdAt,
      updatedAt: createdAt,
    });
  });

  it('never carries the password, even when the entity has it loaded', () => {
    expect(UserResponseDto.from(user)).not.toHaveProperty('password');
    expect(JSON.stringify(UserResponseDto.from(user))).not.toContain('$2b$');
  });
});
