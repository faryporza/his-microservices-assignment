import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { UserRole } from '../constants/user-roles.enum';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  const createMockContext = (
    user?: Partial<AuthenticatedUser>,
  ): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user,
        }),
      }),
    }) as unknown as ExecutionContext;

  it('allows access if no @RequirePermission metadata is set', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext({
      id: 'u-1',
      role: UserRole.PATIENT,
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException if user is not authenticated', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['medical-record:read']);
    const context = createMockContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows ADMIN wildcard access to all permissions', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['arbitrary:custom-permission']);
    const context = createMockContext({
      id: 'u-admin',
      role: UserRole.ADMIN,
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows DOCTOR access to clinical permissions', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['medical-record:create', 'visit:read']);
    const context = createMockContext({
      id: 'u-doc',
      role: UserRole.DOCTOR,
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects DOCTOR attempting finance payment action', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['invoice:pay']);
    const context = createMockContext({
      id: 'u-doc',
      role: UserRole.DOCTOR,
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow(
      'Forbidden resource: missing required permission(s) [invoice:pay]',
    );
  });
});
