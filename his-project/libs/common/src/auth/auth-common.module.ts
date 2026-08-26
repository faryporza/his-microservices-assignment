import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { ResourceOwnershipGuard } from './guards/resource-ownership.guard';
import { RateLimitGuard } from '../throttler/rate-limit.guard';
import { RedisModule } from '../redis/redis.module';
import { getRequiredSecret } from '../config/environment.config';

@Global()
@Module({
  imports: [
    ConfigModule,
    RedisModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => ({
        secret: getRequiredSecret(configService, 'JWT_SECRET'),
        signOptions: {
          expiresIn:
            (configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m') as
              number | `${number}${'s' | 'm' | 'h' | 'd' | 'w' | 'y'}`) ||
            '15m',
        },
      }),
    }),
  ],
  providers: [
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
    ResourceOwnershipGuard,
    RateLimitGuard,
  ],
  exports: [
    JwtModule,
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
    ResourceOwnershipGuard,
    RateLimitGuard,
    RedisModule,
  ],
})
export class AuthCommonModule {}
