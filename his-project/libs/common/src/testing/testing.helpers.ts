import { INestApplication, Provider, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import { createStrictValidationPipe } from '../validation/strict-validation.pipe';
import { TransformInterceptor } from '../response/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../filters/all-exceptions.filter';
import { StructuredLogger } from '../logging/structured.logger';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../auth/constants/user-roles.enum';
import { RedisService } from '../redis/redis.service';
import { SessionMetadata } from '../redis/redis.types';

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

  const swaggerConfig = new DocumentBuilder()
    .setTitle(`${serviceName} test API`)
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

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
    ...(user.patient_id ? { patient_id: user.patient_id } : {}),
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
  const sessions = new Map<string, SessionMetadata>();
  const blacklistedTokens = new Set<string>();

  return {
    createSession: jest
      .fn()
      .mockImplementation(
        (userId: string, sessionId: string, meta: SessionMetadata) => {
          sessions.set(`${userId}:${sessionId}`, meta);
          return Promise.resolve();
        },
      ),
    getSession: jest
      .fn()
      .mockImplementation((userId: string, sessionId: string) => {
        return Promise.resolve(
          sessions.get(`${userId}:${sessionId}`) ?? {
            userId: userId || 'mock-user-uuid-1',
            username: 'mock_admin',
            role: UserRole.ADMIN,
            refreshTokenJti: 'mock-refresh-jti-1',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 604800000).toISOString(),
          },
        );
      }),
    updateSessionRefreshToken: jest
      .fn()
      .mockImplementation(
        (userId: string, sessionId: string, newRefreshTokenJti: string) => {
          const existing = sessions.get(`${userId}:${sessionId}`);
          if (existing) {
            sessions.set(`${userId}:${sessionId}`, {
              ...existing,
              refreshTokenJti: newRefreshTokenJti,
            });
          }
          return Promise.resolve();
        },
      ),
    revokeSession: jest
      .fn()
      .mockImplementation((userId: string, sessionId: string) => {
        sessions.delete(`${userId}:${sessionId}`);
        return Promise.resolve();
      }),
    revokeAllUserSessions: jest.fn().mockImplementation((userId: string) => {
      for (const key of Array.from(sessions.keys())) {
        if (key.startsWith(`${userId}:`)) {
          sessions.delete(key);
        }
      }
      return Promise.resolve();
    }),
    blacklistAccessToken: jest.fn().mockImplementation((jti: string) => {
      blacklistedTokens.add(jti);
      return Promise.resolve();
    }),
    isAccessTokenBlacklisted: jest.fn().mockImplementation((jti: string) => {
      return Promise.resolve(blacklistedTokens.has(jti));
    }),
    revokeSessionsByUsernames: jest.fn().mockResolvedValue(0),
  };
}
