import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { UserRole } from '../constants/user-roles.enum';
import { ROLES_KEY, Roles } from './roles.decorator';
import { IS_PUBLIC_KEY, Public } from './public.decorator';
import {
  CurrentUser,
  getCurrentUserFromContext,
} from './current-user.decorator';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

describe('Auth Decorators and Roles', () => {
  const reflector = new Reflector();

  describe('UserRole Enum', () => {
    it('should define standard healthcare roles', () => {
      expect(UserRole.ADMIN).toBe('ADMIN');
      expect(UserRole.DOCTOR).toBe('DOCTOR');
      expect(UserRole.NURSE).toBe('NURSE');
      expect(UserRole.FINANCE_STAFF).toBe('FINANCE_STAFF');
      expect(UserRole.PATIENT).toBe('PATIENT');
    });
  });

  describe('@Roles Decorator', () => {
    class SampleController {
      @Roles(UserRole.ADMIN, UserRole.DOCTOR)
      handlerMethod() {}
    }

    @Roles(UserRole.FINANCE_STAFF)
    class SampleClassLevelController {
      handlerMethod() {}
    }

    it('should set metadata on handler method', () => {
      const roles = reflector.get<UserRole[]>(
        ROLES_KEY,
        SampleController.prototype.handlerMethod,
      );
      expect(roles).toEqual([UserRole.ADMIN, UserRole.DOCTOR]);
    });

    it('should set metadata on controller class', () => {
      const roles = reflector.get<UserRole[]>(
        ROLES_KEY,
        SampleClassLevelController,
      );
      expect(roles).toEqual([UserRole.FINANCE_STAFF]);
    });
  });

  describe('@Public Decorator', () => {
    class SamplePublicController {
      @Public()
      publicMethod() {}

      protectedMethod() {}
    }

    it('should set isPublic metadata to true on method', () => {
      const isPublic = reflector.get<boolean>(
        IS_PUBLIC_KEY,
        SamplePublicController.prototype.publicMethod,
      );
      expect(isPublic).toBe(true);
    });

    it('should return undefined when @Public() is not applied', () => {
      const isPublic = reflector.get<boolean>(
        IS_PUBLIC_KEY,
        SamplePublicController.prototype.protectedMethod,
      );
      expect(isPublic).toBeUndefined();
    });
  });

  describe('@CurrentUser Decorator', () => {
    const mockUser: AuthenticatedUser = {
      id: 'usr-uuid-1',
      username: 'doctor_strange',
      role: UserRole.DOCTOR,
      sessionId: 'sess-uuid-1',
      email: 'doctor@hospital.org',
    };

    class SampleUserController {
      profileMethod(@CurrentUser() user: AuthenticatedUser) {
        return user;
      }
    }

    function createMockContext(user?: AuthenticatedUser): ExecutionContext {
      return {
        switchToHttp: () => ({
          getRequest: () => ({
            user,
          }),
        }),
      } as unknown as ExecutionContext;
    }

    it('should be valid as a parameter decorator', () => {
      expect(SampleUserController.prototype.profileMethod).toBeDefined();
    });

    it('should extract full user object when no property is specified', () => {
      const context = createMockContext(mockUser);
      const result = getCurrentUserFromContext(undefined, context);
      expect(result).toEqual(mockUser);
    });

    it('should extract specific property when property name is provided', () => {
      const context = createMockContext(mockUser);
      const userId = getCurrentUserFromContext('id', context);
      const role = getCurrentUserFromContext('role', context);

      expect(userId).toBe('usr-uuid-1');
      expect(role).toBe(UserRole.DOCTOR);
    });

    it('should return undefined when request has no authenticated user', () => {
      const context = createMockContext(undefined);
      const result = getCurrentUserFromContext(undefined, context);
      expect(result).toBeUndefined();
    });
  });
});
