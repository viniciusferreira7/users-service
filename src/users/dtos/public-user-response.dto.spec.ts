import type { User } from '../entities/user.entity';
import { UserRole } from '../enums/user-role.enum';
import { UserStatus } from '../enums/user-status.enum';
import { PublicUserResponseDto } from './public-user-response.dto';

const createdAt = new Date('2026-09-24T12:00:00.000Z');

const user = {
  id: 'user-1',
  email: 'ana@marketplace.dev',
  password: '$2b$10$hash',
  firstName: 'Ana',
  lastName: 'Souza',
  role: UserRole.SELLER,
  status: UserStatus.ACTIVE,
  createdAt,
  updatedAt: createdAt,
} satisfies User;

describe('PublicUserResponseDto.from', () => {
  it('copies exactly the fields any logged-in user may see', () => {
    expect({ ...PublicUserResponseDto.from(user) }).toEqual({
      id: 'user-1',
      firstName: 'Ana',
      lastName: 'Souza',
      role: UserRole.SELLER,
      status: UserStatus.ACTIVE,
    });
  });

  it('never carries the email or the password', () => {
    const serialized = JSON.stringify(PublicUserResponseDto.from(user));

    expect(serialized).not.toContain('ana@marketplace.dev');
    expect(serialized).not.toContain('$2b$');
  });
});
