import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { UserRole } from '../constants/user-roles.enum';
import {
  RESOURCE_OWNERSHIP_KEY,
  ResourceOwnershipOptions,
} from '../decorators/resource-ownership.decorator';

@Injectable()
export class ResourceOwnershipGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<
      ResourceOwnershipOptions | undefined
    >(RESOURCE_OWNERSHIP_KEY, [context.getHandler(), context.getClass()]);

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      params?: Record<string, string>;
      query?: Record<string, string>;
    }>();

    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Access denied: unauthenticated actor');
    }

    // Administrative, clinical, and staff roles bypass patient-scoped ownership
    if (
      user.role === UserRole.ADMIN ||
      user.role === UserRole.DOCTOR ||
      user.role === UserRole.NURSE ||
      user.role === UserRole.FINANCE_STAFF
    ) {
      return true;
    }

    // For PATIENT role, enforce strict ownership matching
    if (user.role === UserRole.PATIENT) {
      const actorPatientId = user.patient_id || user.id;
      const paramKey = options.paramKey ?? 'id';
      const resourceId =
        request.params?.[paramKey] ??
        request.query?.[paramKey] ??
        request.query?.patient_id ??
        request.query?.patientId;

      if (!actorPatientId) {
        throw new ForbiddenException(
          'Access denied: patient account has no registered patient profile',
        );
      }

      if (options.resourceType === 'patient') {
        if (resourceId && resourceId !== actorPatientId) {
          throw new ForbiddenException(
            'Access denied: resource belongs to another patient',
          );
        }
      }

      // Route parameter check for queries with explicit patient_id
      const queryPatientId =
        request.query?.patient_id ?? request.query?.patientId;
      if (queryPatientId && queryPatientId !== actorPatientId) {
        throw new ForbiddenException(
          'Access denied: resource belongs to another patient',
        );
      }
    }

    return true;
  }
}
