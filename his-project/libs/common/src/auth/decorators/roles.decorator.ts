import { CustomDecorator, SetMetadata } from '@nestjs/common';
import { UserRole } from '../constants/user-roles.enum';

export const ROLES_KEY = 'roles';

/**
 * Decorator to declare required user roles for a route or controller.
 *
 * @example
 * @Roles(UserRole.ADMIN, UserRole.DOCTOR)
 * @Get('records')
 */
export const Roles = (...roles: UserRole[]): CustomDecorator<string> =>
  SetMetadata(ROLES_KEY, roles);
