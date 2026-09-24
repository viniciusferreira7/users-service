import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, type Repository } from 'typeorm';
import { User } from './entities/user.entity';

export type CreateUserData = Pick<
  User,
  'email' | 'password' | 'firstName' | 'lastName' | 'role' | 'status'
>;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOneBy({ email });
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
