import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '@apps/iam-bc/modules/auth/services/auth.service';
import { UsersService } from '@apps/iam-bc/modules/user/services/users.service';
import { PasswordHashService } from '@apps/iam-bc/modules/auth/services/password-hash.service';
import { RedisService, UserRole } from '@app/common';
import { User } from '@apps/iam-bc/modules/user/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let passwordHashService: jest.Mocked<PasswordHashService>;
  let jwtService: jest.Mocked<JwtService>;
  let redisService: jest.Mocked<RedisService>;

  const activeUser: User = {
    id: 'user-uuid-1',
    username: 'dr_watson',
    email: 'watson@baker.st',
    password_hash: 'hashed_secret',
    first_name: 'John',
    last_name: 'Watson',
    role: UserRole.DOCTOR,
    is_active: true,
    created_at: new Date('2026-08-25T12:00:00Z'),
    updated_at: new Date('2026-08-25T12:00:00Z'),
  };

  const inactiveUser: User = {
    ...activeUser,
    id: 'user-uuid-2',
    is_active: false,
  };

  const mockSession = {
    userId: 'user-uuid-1',
    username: 'dr_watson',
    role: UserRole.DOCTOR,
    refreshTokenJti: 'current-refresh-jti',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 604800000).toISOString(),
  };

  beforeEach(async () => {
    usersService = {
      create: jest.fn().mockResolvedValue(activeUser),
      findByUsernameOrEmail: jest.fn(),
      findById: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    passwordHashService = {
      hashPassword: jest.fn().mockResolvedValue('hashed_secret'),
      verifyPassword: jest.fn(),
    } as unknown as jest.Mocked<PasswordHashService>;

    jwtService = {
      signAsync: jest
        .fn()
        .mockResolvedValueOnce('mock_access_token')
        .mockResolvedValueOnce('mock_refresh_token'),
      verifyAsync: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    redisService = {
      createSession: jest.fn().mockResolvedValue(undefined),
      getSession: jest.fn().mockResolvedValue(mockSession),
      revokeSession: jest.fn().mockResolvedValue(undefined),
      revokeAllUserSessions: jest.fn().mockResolvedValue(undefined),
      blacklistAccessToken: jest.fn().mockResolvedValue(undefined),
      isAccessTokenBlacklisted: jest.fn().mockResolvedValue(false),
    } as unknown as jest.Mocked<RedisService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: PasswordHashService, useValue: passwordHashService },
        { provide: JwtService, useValue: jwtService },
        { provide: RedisService, useValue: redisService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: string) => {
              if (key === 'JWT_ACCESS_EXPIRES_IN') return '15m';
              if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
              return def ?? 'a-very-strong-test-secret-key-that-has-32-chars';
            }),
            getOrThrow: jest.fn(
              () => 'a-very-strong-test-secret-key-that-has-32-chars',
            ),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should hash password and create user, returning user without password_hash', async () => {
      const result = await service.register({
        username: 'dr_watson',
        email: 'watson@baker.st',
        password: 'Password123!',
        first_name: 'John',
        last_name: 'Watson',
      });

      expect(passwordHashService.hashPassword).toHaveBeenCalledWith(
        'Password123!',
      );
      expect(usersService.create).toHaveBeenCalledWith({
        username: 'dr_watson',
        email: 'watson@baker.st',
        password_hash: 'hashed_secret',
        first_name: 'John',
        last_name: 'Watson',
        role: UserRole.PATIENT,
      });

      expect((result as Record<string, unknown>).password_hash).toBeUndefined();
      expect(result.id).toBe('user-uuid-1');
      expect(result.username).toBe('dr_watson');
      expect(result.email).toBe('watson@baker.st');
    });

    it('should propagate ConflictException when username/email is already taken', async () => {
      usersService.create.mockRejectedValueOnce(
        new ConflictException('Username already registered'),
      );

      await expect(
        service.register({
          username: 'dr_watson',
          email: 'watson@baker.st',
          password: 'Password123!',
          first_name: 'John',
          last_name: 'Watson',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects legacy privileged test-account identifiers from public registration', async () => {
      await expect(
        service.register({
          username: 'admin_test_user',
          email: 'new-address@hospital.local',
          password: 'Password123!',
          first_name: 'Reserved',
          last_name: 'Account',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(passwordHashService.hashPassword).not.toHaveBeenCalled();
      expect(usersService.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should authenticate user, create Redis session, and return token pair', async () => {
      usersService.findByUsernameOrEmail.mockResolvedValueOnce(activeUser);
      passwordHashService.verifyPassword.mockResolvedValueOnce(true);

      const result = await service.login({
        username: 'dr_watson',
        password: 'Password123!',
      });

      expect(usersService.findByUsernameOrEmail).toHaveBeenCalledWith(
        'dr_watson',
      );
      expect(passwordHashService.verifyPassword).toHaveBeenCalledWith(
        'Password123!',
        'hashed_secret',
      );
      expect(redisService.createSession).toHaveBeenCalled();
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);

      expect(result).toEqual({
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        token_type: 'Bearer',
        expires_in: 900,
      });
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      usersService.findByUsernameOrEmail.mockResolvedValueOnce(null);

      await expect(
        service.login({
          username: 'unknown_user',
          password: 'Password123!',
        }),
      ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      usersService.findByUsernameOrEmail.mockResolvedValueOnce(activeUser);
      passwordHashService.verifyPassword.mockResolvedValueOnce(false);

      await expect(
        service.login({
          username: 'dr_watson',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
    });

    it('should throw UnauthorizedException when user account is inactive', async () => {
      usersService.findByUsernameOrEmail.mockResolvedValueOnce(inactiveUser);

      await expect(
        service.login({
          username: 'dr_watson',
          password: 'Password123!',
        }),
      ).rejects.toThrow(new UnauthorizedException('Account is disabled'));
    });
  });

  describe('refreshToken', () => {
    it('should rotate refresh token and issue new token pair when token and session are valid', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({
        sub: 'user-uuid-1',
        sid: 'session-uuid-1',
        jti: 'current-refresh-jti',
        type: 'refresh',
      });
      usersService.findById.mockResolvedValueOnce(activeUser);

      const result = await service.refreshToken({
        refresh_token: 'valid_refresh_token',
      });

      expect(jwtService.verifyAsync).toHaveBeenCalledWith(
        'valid_refresh_token',
        expect.any(Object),
      );
      expect(redisService.getSession).toHaveBeenCalledWith(
        'user-uuid-1',
        'session-uuid-1',
      );
      expect(redisService.createSession).toHaveBeenCalled();
      expect(result).toEqual({
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        token_type: 'Bearer',
        expires_in: 900,
      });
    });

    it('should throw UnauthorizedException when refresh token verification fails', async () => {
      jwtService.verifyAsync.mockRejectedValueOnce(new Error('jwt expired'));

      await expect(
        service.refreshToken({ refresh_token: 'expired_token' }),
      ).rejects.toThrow(
        new UnauthorizedException('Invalid or expired refresh token'),
      );
    });

    it('should throw UnauthorizedException when session not found in Redis', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({
        sub: 'user-uuid-1',
        sid: 'session-uuid-1',
        jti: 'current-refresh-jti',
        type: 'refresh',
      });
      redisService.getSession.mockResolvedValueOnce(null);

      await expect(
        service.refreshToken({ refresh_token: 'valid_token' }),
      ).rejects.toThrow(
        new UnauthorizedException('Session has expired or been revoked'),
      );
    });

    it('should detect replay attack and revoke all sessions when JTI does not match', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({
        sub: 'user-uuid-1',
        sid: 'session-uuid-1',
        jti: 'old-stolen-refresh-jti',
        type: 'refresh',
      });
      redisService.getSession.mockResolvedValueOnce(mockSession);

      await expect(
        service.refreshToken({ refresh_token: 'replayed_token' }),
      ).rejects.toThrow(
        new UnauthorizedException(
          'Token reuse detected. All sessions have been revoked.',
        ),
      );

      expect(redisService.revokeAllUserSessions).toHaveBeenCalledWith(
        'user-uuid-1',
      );
    });
  });

  describe('logout', () => {
    it('should blacklist access token and revoke Redis session', async () => {
      const result = await service.logout({
        id: 'user-uuid-1',
        username: 'dr_watson',
        role: UserRole.DOCTOR,
        sessionId: 'session-uuid-1',
        jti: 'access-jti-1',
      });

      expect(redisService.blacklistAccessToken).toHaveBeenCalledWith(
        'access-jti-1',
        900,
      );
      expect(redisService.revokeSession).toHaveBeenCalledWith(
        'user-uuid-1',
        'session-uuid-1',
      );
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });

  describe('getProfile', () => {
    it('should return sanitized user profile', async () => {
      usersService.findById.mockResolvedValueOnce(activeUser);

      const result = await service.getProfile({
        id: 'user-uuid-1',
        username: 'dr_watson',
        role: UserRole.DOCTOR,
      });

      expect(usersService.findById).toHaveBeenCalledWith('user-uuid-1');
      expect((result as Record<string, unknown>).password_hash).toBeUndefined();
      expect(result.id).toBe('user-uuid-1');
      expect(result.username).toBe('dr_watson');
      expect(result.role).toBe(UserRole.DOCTOR);
    });
  });
});
