import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
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
    const { id } = await this.users.save(this.users.create(data));

    return this.users.findOneByOrFail({ id });
  }
}
