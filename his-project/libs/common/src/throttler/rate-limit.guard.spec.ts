import {
  ExecutionContext,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard } from './rate-limit.guard';
import { RedisService } from '../redis/redis.service';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let reflector: Reflector;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(() => {
    reflector = new Reflector();
    redisService = {
      incrementRateLimitCounter: jest.fn(),
    } as unknown as jest.Mocked<RedisService>;
    guard = new RateLimitGuard(reflector, redisService);
  });

  const createMockContext = (
    ip = '127.0.0.1',
    body = { username: 'test_user' },
  ): {
    context: ExecutionContext;
    headers: Record<string, string | number>;
  } => {
    const headers: Record<string, string | number> = {};
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ ip, body, headers: {} }),
        getResponse: () => ({
          setHeader: (name: string, value: string | number) => {
            headers[name] = value;
          },
        }),
      }),
    } as unknown as ExecutionContext;
    return { context, headers };
  };

  it('allows request when no @RateLimit metadata is configured', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const { context } = createMockContext();

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('allows request within rate limit threshold', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue({ limit: 5, ttlSeconds: 60 });
    redisService.incrementRateLimitCounter.mockResolvedValue(3);
    const { context } = createMockContext();

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(redisService.incrementRateLimitCounter).toHaveBeenCalledWith(
      '127.0.0.1:test_user',
      60,
    );
  });

  it('throws 429 Too Many Requests when rate limit threshold is exceeded', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue({ limit: 5, ttlSeconds: 60 });
    redisService.incrementRateLimitCounter.mockResolvedValue(6);
    const { context, headers } = createMockContext();

    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    expect(headers['Retry-After']).toBe(60);
  });

  it('fails closed on Redis communication error', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue({ limit: 5, ttlSeconds: 60 });
    redisService.incrementRateLimitCounter.mockRejectedValue(
      new Error('Redis connection timeout'),
    );
    const { context } = createMockContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
