import type { Repository } from 'typeorm';
import type { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { UserStatus } from './enums/user-status.enum';
import { type CreateUserData, UsersService } from './users.service';

const data: CreateUserData = {
  email: 'ana@marketplace.dev',
  password: '$2b$10$hash',
  firstName: 'Ana',
  lastName: 'Souza',
  role: UserRole.BUYER,
  status: UserStatus.ACTIVE,
};

function makeRepository() {
  return {
    findOneBy: vi.fn(),
    create: vi.fn((input: Partial<User>) => ({ ...input })),
    save: vi.fn(async (entity: Partial<User>) => ({ ...entity, id: 'user-1' })),
    findOneByOrFail: vi.fn(),
  };
}

function makeService(repository: ReturnType<typeof makeRepository>) {
  return new UsersService(repository as unknown as Repository<User>);
}

describe('UsersService', () => {
  it('looks a user up by the exact email it is given', async () => {
    const repository = makeRepository();
    const user = { id: 'user-1', email: data.email } as User;
    repository.findOneBy.mockResolvedValue(user);

    await expect(makeService(repository).findByEmail(data.email)).resolves.toBe(
      user
    );
    expect(repository.findOneBy).toHaveBeenCalledWith({ email: data.email });
  });

  it('answers null when no user has the email', async () => {
    const repository = makeRepository();
    repository.findOneBy.mockResolvedValue(null);

    await expect(
      makeService(repository).findByEmail('nobody@marketplace.dev')
    ).resolves.toBeNull();
  });

  it('saves the user and returns it read back by id', async () => {
    const repository = makeRepository();
    const readBack = { id: 'user-1', email: data.email } as User;
    repository.findOneByOrFail.mockResolvedValue(readBack);

    await expect(makeService(repository).create(data)).resolves.toBe(readBack);
    expect(repository.save).toHaveBeenCalledWith(data);
    expect(repository.findOneByOrFail).toHaveBeenCalledWith({ id: 'user-1' });
  });

  it('lets a database error from save propagate untouched', async () => {
    const repository = makeRepository();
    const failure = new Error('duplicate key');
    repository.save.mockRejectedValue(failure);

    await expect(makeService(repository).create(data)).rejects.toBe(failure);
  });
});
