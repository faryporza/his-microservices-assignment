import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';
import { StructuredLogger } from '../logging/structured.logger';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logger = new StructuredLogger('redis-client');
        const host = configService.get<string>('REDIS_HOST', 'localhost');
        const port = Number(configService.get<string>('REDIS_PORT', '6379'));
        const password =
          configService.get<string>('REDIS_PASSWORD') || undefined;

        const client = new Redis({
          host,
          port,
          password,
          retryStrategy: (times: number) => {
            const delay = Math.min(times * 100, 3000);
            return delay;
          },
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          enableReadyCheck: true,
        });

        client.on('error', (err) => {
          logger.error('Redis connection error', {
            action: 'REDIS_ERROR',
            host,
            port,
            error: err,
          });
        });

        client.on('connect', () => {
          logger.log('Redis connected', {
            action: 'REDIS_CONNECT',
            host,
            port,
          });
        });

        return client;
      },
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
