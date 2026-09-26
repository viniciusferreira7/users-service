import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, type Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { UserStatus } from './enums/user-status.enum';

export type CreateUserData = Pick<
  User,
  'email' | 'password' | 'firstName' | 'lastName' | 'role' | 'status'
>;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>
  ) {}

  findById(id: string): Promise<User | null> {
    return this.users.findOneBy({ id });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOneBy({ email });
  }

  /** Sorted by name, with the id as a tie-breaker, so the order is stable. */
  findActiveSellers(): Promise<User[]> {
    return this.users.find({
      where: { role: UserRole.SELLER, status: UserStatus.ACTIVE },
      order: { firstName: 'ASC', lastName: 'ASC', id: 'ASC' },
    });
  }

  /**
   * The only read that loads the password hash — for checking credentials.
   * Every other read keeps it out through `select: false`.
   */
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  /**
   * Inserts the user and reads it back, so the result carries the
   * database-generated fields and — because of `select: false` — never the
   * password hash that was just written.
   */
  async create(data: CreateUserData): Promise<User> {
    let id: string;

    try {
      ({ id } = await this.users.save(this.users.create(data)));
    } catch (error) {
      throw withoutQueryParameters(error);
    }

    return this.users.findOneByOrFail({ id });
  }
}

/**
 * A failed insert carries its bound values — the password hash among them —
 * and the logger serializes every enumerable property of an error. Drop them
 * so the hash never reaches a log; the SQLSTATE in `driverError` stays.
 */
function withoutQueryParameters(error: unknown): unknown {
  if (error instanceof QueryFailedError) {
    Reflect.deleteProperty(error, 'parameters');
  }

  return error;
}
