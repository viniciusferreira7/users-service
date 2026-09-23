import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { UserRole } from '../enums/user-role.enum';
import { UserStatus } from '../enums/user-status.enum';
import { User } from './user.entity';

const storage = () => getMetadataArgsStorage();

const columnsOf = () => storage().columns.filter((c) => c.target === User);

const column = (propertyName: string) => {
  const found = columnsOf().find((c) => c.propertyName === propertyName);

  if (!found) {
    throw new Error(`User has no column "${propertyName}"`);
  }

  return found;
};

describe('User entity', () => {
  it('maps to the users table', () => {
    expect(storage().tables.find((t) => t.target === User)?.name).toBe('users');
  });

  it('declares exactly the nine user fields', () => {
    expect(
      columnsOf()
        .map((c) => c.propertyName)
        .sort()
    ).toEqual(
      [
        'createdAt',
        'email',
        'firstName',
        'id',
        'lastName',
        'password',
        'role',
        'status',
        'updatedAt',
      ].sort()
    );
  });

  it('generates a uuid primary key', () => {
    const generation = storage().generations.find(
      (g) => g.target === User && g.propertyName === 'id'
    );

    expect(column('id').options.primary).toBe(true);
    expect(generation?.strategy).toBe('uuid');
  });

  it('keeps the email unique', () => {
    expect(column('email').options).toMatchObject({
      type: 'varchar',
      length: 255,
      unique: true,
    });
  });

  it('never selects the password hash by default', () => {
    expect(column('password').options).toMatchObject({
      type: 'varchar',
      length: 255,
      select: false,
    });
  });

  it('stores the names in snake_case columns', () => {
    expect(column('firstName').options).toMatchObject({
      name: 'first_name',
      length: 100,
    });
    expect(column('lastName').options).toMatchObject({
      name: 'last_name',
      length: 100,
    });
  });

  it('requires a role of seller or buyer, with no default', () => {
    const { options } = column('role');

    expect(options.type).toBe('enum');
    expect(Object.values(options.enum as object)).toEqual(['seller', 'buyer']);
    expect(options.default).toBeUndefined();
    expect(options.nullable).not.toBe(true);
    expect(UserRole.SELLER).toBe('seller');
  });

  it('defaults the status to active', () => {
    const { options } = column('status');

    expect(options.type).toBe('enum');
    expect(Object.values(options.enum as object)).toEqual([
      'active',
      'inactive',
    ]);
    expect(options.default).toBe(UserStatus.ACTIVE);
  });

  it('timestamps creation and update automatically', () => {
    expect(column('createdAt')).toMatchObject({
      mode: 'createDate',
      options: { name: 'created_at', type: 'timestamptz' },
    });
    expect(column('updatedAt')).toMatchObject({
      mode: 'updateDate',
      options: { name: 'updated_at', type: 'timestamptz' },
    });
  });
});
