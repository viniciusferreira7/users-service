import type { UserRole } from '../users/enums/user-role.enum';

/** What `req.user` holds on a protected route. */
export type AuthenticatedUser = {
  id: string;
  email: string;
  role: UserRole;
};
