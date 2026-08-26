import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../constants/user-roles.enum';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.ADMIN]: ['*'],
  [UserRole.DOCTOR]: [
    'patient:read',
    'visit:read',
    'visit:create',
    'visit:update',
    'medical-record:read',
    'medical-record:create',
    'medical-record:update',
  ],
  [UserRole.NURSE]: [
    'patient:read',
    'patient:create',
    'patient:update',
    'visit:read',
    'visit:create',
  ],
  [UserRole.FINANCE_STAFF]: [
    'patient:read',
    'invoice:read',
    'invoice:create',
    'invoice:pay',
  ],
  [UserRole.PATIENT]: [
    'patient:read',
    'patient:read-self',
    'visit:read',
    'visit:read-self',
    'medical-record:read',
    'medical-record:read-self',
    'invoice:read',
    'invoice:read-self',
  ],
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<
      string[] | undefined
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
    }>();

    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Access denied: unauthenticated actor');
    }

    const userPermissions = ROLE_PERMISSIONS[user.role] || [];
    if (userPermissions.includes('*')) {
      return true;
    }

    const hasAll = requiredPermissions.every((perm) =>
      userPermissions.includes(perm),
    );

    if (!hasAll) {
      throw new ForbiddenException(
        `Forbidden resource: missing required permission(s) [${requiredPermissions.join(
          ', ',
        )}]`,
      );
    }

    return true;
  }
}
