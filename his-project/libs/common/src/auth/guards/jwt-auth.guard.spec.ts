import { Reflector } from '@nestjs/core';
import {
  ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RedisService } from '../../redis/redis.service';
import { UserRole } from '../constants/user-roles.enum';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;
  let jwtService: jest.Mocked<JwtService>;
  let redisService: jest.Mocked<RedisService>;

  const mockPayload = {
    sub: 'user-uuid-1',
    username: 'nurse_joy',
    role: UserRole.NURSE,
    sid: 'session-uuid-1',
    jti: 'access-jti-1',
    email: 'joy@hospital.org',
  };

  const mockSession = {
    userId: 'user-uuid-1',
    username: 'nurse_joy',
    role: UserRole.NURSE,
    refreshTokenJti: 'refresh-jti-1',
    createdAt: '2026-08-25T12:00:00.000Z',
    expiresAt: '2026-09-01T12:00:00.000Z',
  };

  function createMockExecutionContext(
    headers: Record<string, string> = {},
    requestUser?: unknown,
  ): {
    context: ExecutionContext;
    request: { headers: Record<string, string>; user?: unknown };
  } {
    const request = {
      headers,
      user: requestUser,
    };

    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    return { context, request };
  }

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as jest.Mocked<Reflector>;

    jwtService = {
      verifyAsync: jest.fn().mockResolvedValue(mockPayload),
    } as unknown as jest.Mocked<JwtService>;

    redisService = {
      isAccessTokenBlacklisted: jest.fn().mockResolvedValue(false),
      getSession: jest.fn().mockResolvedValue(mockSession),
    } as unknown as jest.Mocked<RedisService>;

    guard = new JwtAuthGuard(reflector, jwtService, redisService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access when route has @Public() decorator', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(true);
    const { context } = createMockExecutionContext();

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException when authorization header is missing', async () => {
    const { context } = createMockExecutionContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException when header does not start with Bearer', async () => {
    const { context } = createMockExecutionContext({
      authorization: 'Basic dXNlcjpwYXNz',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException when JWT verification fails', async () => {
    jwtService.verifyAsync.mockRejectedValueOnce(new Error('jwt expired'));
    const { context } = createMockExecutionContext({
      authorization: 'Bearer expired-token',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should reject a verified token that is missing stateful auth claims', async () => {
    jwtService.verifyAsync.mockResolvedValueOnce({
      ...mockPayload,
      sid: undefined,
    });
    const { context } = createMockExecutionContext({
      authorization: 'Bearer structurally-valid-but-incomplete-token',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid authentication claims'),
    );
    expect(redisService.getSession).not.toHaveBeenCalled();
  });

  it('should forward the mapped patient identity from the token', async () => {
    jwtService.verifyAsync.mockResolvedValueOnce({
      ...mockPayload,
      role: UserRole.PATIENT,
      patient_id: 'patient-uuid-1',
    });
    const { context, request } = createMockExecutionContext({
      authorization: 'Bearer patient-token',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(
      expect.objectContaining({
        role: UserRole.PATIENT,
        patient_id: 'patient-uuid-1',
      }),
    );
  });

  it('should throw UnauthorizedException when token JTI is blacklisted in Redis', async () => {
    redisService.isAccessTokenBlacklisted.mockResolvedValueOnce(true);
    const { context } = createMockExecutionContext({
      authorization: 'Bearer valid-token',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Session has been revoked'),
    );
    expect(redisService.isAccessTokenBlacklisted).toHaveBeenCalledWith(
      'access-jti-1',
    );
  });

  it('should throw UnauthorizedException when session is missing in Redis', async () => {
    redisService.getSession.mockResolvedValueOnce(null);
    const { context } = createMockExecutionContext({
      authorization: 'Bearer valid-token',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Session has been revoked or expired'),
    );
    expect(redisService.getSession).toHaveBeenCalledWith(
      'user-uuid-1',
      'session-uuid-1',
    );
  });

  it('should throw ServiceUnavailableException when Redis is unreachable (fail-closed)', async () => {
    redisService.isAccessTokenBlacklisted.mockRejectedValueOnce(
      new Error('ECONNREFUSED'),
    );
    const { context } = createMockExecutionContext({
      authorization: 'Bearer valid-token',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('should successfully activate and attach user context to request when token and session are valid', async () => {
    const { context, request } = createMockExecutionContext({
      authorization: 'Bearer valid-token',
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual({
      id: 'user-uuid-1',
      username: 'nurse_joy',
      role: UserRole.NURSE,
      sessionId: 'session-uuid-1',
      jti: 'access-jti-1',
      email: 'joy@hospital.org',
    });
  });
});
