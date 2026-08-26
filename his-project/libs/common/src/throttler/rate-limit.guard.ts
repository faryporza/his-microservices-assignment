import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../redis/redis.service';
import { RATE_LIMIT_KEY, RateLimitOptions } from './rate-limit.decorator';
import { StructuredLogger } from '../logging/structured.logger';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new StructuredLogger('rate-limit-guard');

  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<
      RateLimitOptions | undefined
    >(RATE_LIMIT_KEY, [context.getHandler(), context.getClass()]);

    if (!options) {
      return true;
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<{
      ip?: string;
      headers?: Record<string, string>;
      body?: { username?: string; email?: string };
    }>();
    const response = httpContext.getResponse<{
      setHeader?: (name: string, value: string | number) => void;
      header?: (name: string, value: string | number) => void;
    }>();

    const clientIp =
      request.headers?.['x-forwarded-for'] || request.ip || '127.0.0.1';
    const identifier =
      request.body?.username || request.body?.email || clientIp;
    const rateLimitKey = `${clientIp}:${identifier}`;

    try {
      const currentCount = await this.redisService.incrementRateLimitCounter(
        rateLimitKey,
        options.ttlSeconds,
      );

      if (currentCount > options.limit) {
        if (response.setHeader) {
          response.setHeader('Retry-After', options.ttlSeconds);
        } else if (response.header) {
          response.header('Retry-After', options.ttlSeconds);
        }

        this.logger.warn({
          message: 'Rate limit exceeded',
          context: {
            action: 'RATE_LIMIT_EXCEEDED',
            client_ip: clientIp,
            identifier_type: request.body?.username
              ? 'username'
              : request.body?.email
                ? 'email'
                : 'ip',
            limit: options.limit,
            count: currentCount,
          },
        });

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too Many Requests: Rate limit exceeded',
            retryAfter: options.ttlSeconds,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error({
        message: 'Redis rate limiting service unavailable',
        context: { action: 'RATE_LIMIT_SERVICE_UNAVAILABLE' },
        error,
      });
      throw new ServiceUnavailableException(
        'Rate limiting service unavailable',
      );
    }
  }
}
