import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import {
  createPostgresOptions,
  CommonModule,
  AuthCommonModule,
  JwtAuthGuard,
  RolesGuard,
  OutboxEvent,
  ProcessedEvent,
  InitIam1000000000000,
} from '@app/common';
import { IamHealthChecksController } from './health-checks.controller';
import { IamHealthChecksService } from './health-checks.service';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { User } from './modules/user/entities/user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        createPostgresOptions(configService, 'IAM_DATABASE', {
          entities: [User, OutboxEvent, ProcessedEvent],
          migrations: [InitIam1000000000000],
          synchronize: false,
        }),
    }),
    CommonModule,
    AuthCommonModule,
    UserModule,
    AuthModule,
  ],
  controllers: [IamHealthChecksController],
  providers: [
    IamHealthChecksService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [UserModule, AuthModule],
})
export class IamBcModule {}
