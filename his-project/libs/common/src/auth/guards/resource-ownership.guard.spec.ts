import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ResourceOwnershipGuard } from './resource-ownership.guard';
import { UserRole } from '../constants/user-roles.enum';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

describe('ResourceOwnershipGuard', () => {
  let guard: ResourceOwnershipGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new ResourceOwnershipGuard(reflector);
  });

  const createMockContext = (
    user?: Partial<AuthenticatedUser>,
    params: Record<string, string> = {},
    query: Record<string, string> = {},
  ): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          params,
          query,
        }),
      }),
    }) as unknown as ExecutionContext;

  it('allows access if no @CheckResourceOwnership metadata is present', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext({
      id: 'u-1',
      role: UserRole.PATIENT,
      patient_id: 'p-1',
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException if user is not authenticated', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      resourceType: 'patient',
      paramKey: 'id',
    });
    const context = createMockContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows administrative and clinical roles to bypass ownership checks', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      resourceType: 'patient',
      paramKey: 'id',
    });

    const adminContext = createMockContext(
      { id: 'u-admin', role: UserRole.ADMIN },
      { id: 'p-other' },
    );
    expect(guard.canActivate(adminContext)).toBe(true);

    const docContext = createMockContext(
      { id: 'u-doc', role: UserRole.DOCTOR },
      { id: 'p-other' },
    );
    expect(guard.canActivate(docContext)).toBe(true);
  });

  it('allows patient accessing their own resource', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      resourceType: 'patient',
      paramKey: 'id',
    });

    const context = createMockContext(
      { id: 'u-1', role: UserRole.PATIENT, patient_id: 'p-1' },
      { id: 'p-1' },
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it('fails closed (throws ForbiddenException) if patient accesses another patient resource', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      resourceType: 'patient',
      paramKey: 'id',
    });

    const context = createMockContext(
      { id: 'u-1', role: UserRole.PATIENT, patient_id: 'p-1' },
      { id: 'p-2' },
    );
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow(
      'Access denied: resource belongs to another patient',
    );
  });

  it('fails closed if patient accesses route with mismatched patient_id query param', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      resourceType: 'visit',
      paramKey: 'id',
    });

    const context = createMockContext(
      { id: 'u-1', role: UserRole.PATIENT, patient_id: 'p-1' },
      { id: 'v-1' },
      { patientId: 'p-2' },
    );
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
