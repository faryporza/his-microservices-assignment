import { INestApplication, Provider, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import { createStrictValidationPipe } from '../validation/strict-validation.pipe';
import { TransformInterceptor } from '../response/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../filters/all-exceptions.filter';
import { StructuredLogger } from '../logging/structured.logger';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../auth/constants/user-roles.enum';
import { RedisService } from '../redis/redis.service';

export function createTestingModule(
  controllers: Type<object>[] = [],
  providers: Provider[] = [],
): TestingModuleBuilder {
  return Test.createTestingModule({
    controllers,
    providers,
  });
}

export function createTestApp(
  module: TestingModule,
  serviceName = 'test-app',
): INestApplication {
  const app = module.createNestApplication();
  const reflector = app.get(Reflector);
  const logger = new StructuredLogger(serviceName);

  app.useGlobalPipes(createStrictValidationPipe());
  app.useGlobalInterceptors(new TransformInterceptor(reflector));
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  return app;
}

export function createMockJwtToken(
  user: Partial<AuthenticatedUser> = {},
  options?: { secret?: string; expiresIn?: string | number },
): string {
  const secret =
    options?.secret ??
    process.env.JWT_SECRET ??
    'his-secret-jwt-key-for-development-change-in-production';

  const payload = {
    sub: user.id ?? 'mock-user-uuid-1',
    username: user.username ?? 'mock_admin',
    role: user.role ?? UserRole.ADMIN,
    sid: user.sessionId ?? 'mock-session-uuid-1',
    jti: user.jti ?? 'mock-access-jti-1',
    email: user.email ?? 'mock@his.local',
  };

  return jwt.sign(payload, secret, {
    expiresIn: (options?.expiresIn ?? '1h') as jwt.SignOptions['expiresIn'],
  });
}

export function createMockAuthHeaders(
  user: Partial<AuthenticatedUser> = {},
  options?: { secret?: string; expiresIn?: string | number },
): { authorization: string } {
  return {
    authorization: `Bearer ${createMockJwtToken(user, options)}`,
  };
}

export function createMockRedisService(): Partial<RedisService> {
  return {
    createSession: jest.fn().mockResolvedValue(undefined),
    getSession: jest.fn().mockImplementation((userId: string) => {
      return Promise.resolve({
        userId: userId || 'mock-user-uuid-1',
        username: 'mock_admin',
        role: UserRole.ADMIN,
        refreshTokenJti: 'mock-refresh-jti-1',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 604800000).toISOString(),
      });
    }),
    revokeSession: jest.fn().mockResolvedValue(undefined),
    revokeAllUserSessions: jest.fn().mockResolvedValue(undefined),
    blacklistAccessToken: jest.fn().mockResolvedValue(undefined),
    isAccessTokenBlacklisted: jest.fn().mockResolvedValue(false),
  };
}
