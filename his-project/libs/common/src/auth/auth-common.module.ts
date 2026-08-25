import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { RedisModule } from '../redis/redis.module';

@Global()
@Module({
  imports: [
    ConfigModule,
    RedisModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => ({
        secret: configService.get<string>(
          'JWT_SECRET',
          'his-secret-jwt-key-for-development-change-in-production',
        ),
        signOptions: {
          expiresIn:
            (configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m') as
              number | `${number}${'s' | 'm' | 'h' | 'd' | 'w' | 'y'}`) ||
            '15m',
        },
      }),
    }),
  ],
  providers: [JwtAuthGuard, RolesGuard],
  exports: [JwtModule, JwtAuthGuard, RolesGuard, RedisModule],
})
export class AuthCommonModule {}
