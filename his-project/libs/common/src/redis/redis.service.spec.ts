import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';
import { REDIS_CLIENT } from './redis.constants';
import { SessionMetadata } from './redis.types';

describe('RedisService', () => {
  let service: RedisService;
  let mockRedisClient: {
    set: jest.Mock;
    get: jest.Mock;
    del: jest.Mock;
    sadd: jest.Mock;
    srem: jest.Mock;
    smembers: jest.Mock;
    exists: jest.Mock;
    expire: jest.Mock;
    ttl: jest.Mock;
    incr: jest.Mock;
    scan: jest.Mock;
    quit: jest.Mock;
    status: string;
    on: jest.Mock;
  };

  const sampleSession: SessionMetadata = {
    userId: 'user-uuid-1',
    username: 'doctor_who',
    role: 'DOCTOR',
    refreshTokenJti: 'refresh-jti-1',
    createdAt: '2026-08-25T12:00:00.000Z',
    expiresAt: '2026-09-01T12:00:00.000Z',
  };

  beforeEach(async () => {
    mockRedisClient = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
      sadd: jest.fn().mockResolvedValue(1),
      srem: jest.fn().mockResolvedValue(1),
      smembers: jest.fn().mockResolvedValue([]),
      exists: jest.fn().mockResolvedValue(0),
      expire: jest.fn().mockResolvedValue(1),
      ttl: jest.fn().mockResolvedValue(604800),
      incr: jest.fn().mockResolvedValue(1),
      scan: jest.fn().mockResolvedValue(['0', []]),
      quit: jest.fn().mockResolvedValue('OK'),
      status: 'ready',
      on: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: REDIS_CLIENT,
          useValue: mockRedisClient,
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Session Management', () => {
    it('should create session and add sessionId to user_sessions set', async () => {
      await service.createSession(
        'user-uuid-1',
        'session-1',
        sampleSession,
        604800,
      );

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'auth:session:user-uuid-1:session-1',
        JSON.stringify(sampleSession),
        'EX',
        604800,
      );
      expect(mockRedisClient.sadd).toHaveBeenCalledWith(
        'auth:user_sessions:user-uuid-1',
        'session-1',
      );
      expect(mockRedisClient.expire).toHaveBeenCalledWith(
        'auth:user_sessions:user-uuid-1',
        604800,
      );
    });

    it('should retrieve existing session', async () => {
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(sampleSession));

      const result = await service.getSession('user-uuid-1', 'session-1');

      expect(mockRedisClient.get).toHaveBeenCalledWith(
        'auth:session:user-uuid-1:session-1',
      );
      expect(result).toEqual(sampleSession);
    });

    it('should return null when session does not exist', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);

      const result = await service.getSession('user-uuid-1', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should update session refresh token maintaining remaining TTL', async () => {
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(sampleSession));
      mockRedisClient.ttl.mockResolvedValueOnce(3600);

      await service.updateSessionRefreshToken(
        'user-uuid-1',
        'session-1',
        'new-refresh-jti',
      );

      const expectedUpdated = {
        ...sampleSession,
        refreshTokenJti: 'new-refresh-jti',
      };

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'auth:session:user-uuid-1:session-1',
        JSON.stringify(expectedUpdated),
        'EX',
        3600,
      );
    });

    it('should throw error when updating non-existent session', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);

      await expect(
        service.updateSessionRefreshToken(
          'user-uuid-1',
          'session-1',
          'new-jti',
        ),
      ).rejects.toThrow('Session auth:session:user-uuid-1:session-1 not found');
    });

    it('should revoke a single session and remove from user_sessions set', async () => {
      await service.revokeSession('user-uuid-1', 'session-1');

      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'auth:session:user-uuid-1:session-1',
      );
      expect(mockRedisClient.srem).toHaveBeenCalledWith(
        'auth:user_sessions:user-uuid-1',
        'session-1',
      );
    });

    it('should revoke all user sessions and delete user_sessions set', async () => {
      mockRedisClient.smembers.mockResolvedValueOnce([
        'session-1',
        'session-2',
      ]);

      await service.revokeAllUserSessions('user-uuid-1');

      expect(mockRedisClient.smembers).toHaveBeenCalledWith(
        'auth:user_sessions:user-uuid-1',
      );
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'auth:session:user-uuid-1:session-1',
      );
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'auth:session:user-uuid-1:session-2',
      );
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'auth:user_sessions:user-uuid-1',
      );
    });

    it('should revoke sessions belonging to retired usernames', async () => {
      mockRedisClient.scan
        .mockResolvedValueOnce(['0', ['auth:session:user-uuid-1:session-1']])
        .mockResolvedValueOnce(['0', []]);
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(sampleSession));

      await expect(
        service.revokeSessionsByUsernames(new Set(['doctor_who'])),
      ).resolves.toBe(1);
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'auth:session:user-uuid-1:session-1',
      );
      expect(mockRedisClient.srem).toHaveBeenCalledWith(
        'auth:user_sessions:user-uuid-1',
        'session-1',
      );
    });
  });

  describe('Token Blacklist', () => {
    it('should blacklist access token JTI with specified TTL', async () => {
      await service.blacklistAccessToken('access-jti-1', 900);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'auth:blacklist:access-jti-1',
        'revoked',
        'EX',
        900,
      );
    });

    it('should return true when access token JTI is blacklisted', async () => {
      mockRedisClient.exists.mockResolvedValueOnce(1);

      const isBlacklisted =
        await service.isAccessTokenBlacklisted('access-jti-1');

      expect(mockRedisClient.exists).toHaveBeenCalledWith(
        'auth:blacklist:access-jti-1',
      );
      expect(isBlacklisted).toBe(true);
    });

    it('should return false when access token JTI is not blacklisted', async () => {
      mockRedisClient.exists.mockResolvedValueOnce(0);

      const isBlacklisted = await service.isAccessTokenBlacklisted('valid-jti');

      expect(isBlacklisted).toBe(false);
    });
  });

  describe('Rate Limiting & Rate Counters', () => {
    it('should increment attempt counter and set expiration on first attempt', async () => {
      mockRedisClient.incr.mockResolvedValueOnce(1);

      const count = await service.incrementRateLimitCounter(
        'login:user-1',
        900,
      );

      expect(mockRedisClient.incr).toHaveBeenCalledWith(
        'auth:ratelimit:login:user-1',
      );
      expect(mockRedisClient.expire).toHaveBeenCalledWith(
        'auth:ratelimit:login:user-1',
        900,
      );
      expect(count).toBe(1);
    });

    it('should increment attempt counter without resetting expiration on subsequent attempts', async () => {
      mockRedisClient.incr.mockResolvedValueOnce(2);

      const count = await service.incrementRateLimitCounter(
        'login:user-1',
        900,
      );

      expect(mockRedisClient.incr).toHaveBeenCalledWith(
        'auth:ratelimit:login:user-1',
      );
      expect(mockRedisClient.expire).not.toHaveBeenCalled();
      expect(count).toBe(2);
    });
  });

  describe('Lifecycle', () => {
    it('should quit Redis client on module destroy', async () => {
      await service.onModuleDestroy();

      expect(mockRedisClient.quit).toHaveBeenCalled();
    });
  });
});
