import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../constants/user-roles.enum';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  function createMockExecutionContext(
    user?: AuthenticatedUser,
  ): ExecutionContext {
    const request = { user };

    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new RolesGuard(reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access when no roles are required on route or class', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(undefined);
    const context = createMockExecutionContext();

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should allow access when user role matches one of the required roles', () => {
    reflector.getAllAndOverride.mockReturnValueOnce([
      UserRole.ADMIN,
      UserRole.DOCTOR,
    ]);
    const context = createMockExecutionContext({
      id: 'usr-1',
      username: 'doctor_who',
      role: UserRole.DOCTOR,
    });

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should throw ForbiddenException when user role does not match required roles', () => {
    reflector.getAllAndOverride.mockReturnValueOnce([UserRole.DOCTOR]);
    const context = createMockExecutionContext({
      id: 'usr-2',
      username: 'finance_guru',
      role: UserRole.FINANCE_STAFF,
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user is not present on request', () => {
    reflector.getAllAndOverride.mockReturnValueOnce([UserRole.DOCTOR]);
    const context = createMockExecutionContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user has invalid or missing role', () => {
    reflector.getAllAndOverride.mockReturnValueOnce([UserRole.ADMIN]);
    const context = createMockExecutionContext({
      id: 'usr-3',
      username: 'unknown_role_user',
      role: '' as unknown as UserRole,
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
