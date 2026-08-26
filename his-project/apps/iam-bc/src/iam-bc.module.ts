import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import {
  createPostgresOptions,
  CommonModule,
  AuthCommonModule,
  AuditModule,
  JwtAuthGuard,
  RolesGuard,
  PermissionsGuard,
  ResourceOwnershipGuard,
  RateLimitGuard,
  OutboxEvent,
  ProcessedEvent,
  InitIam1000000000000,
  HardenIam1000000000001,
  AddSchemaComments20260826000000,
  AuditLog,
} from '@app/common';
import { IamHealthChecksController } from './health-checks.controller';
import { IamHealthChecksService } from './health-checks.service';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { AccessAuditModule } from './modules/audit/access-audit.module';
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
          entities: [User, AuditLog, OutboxEvent, ProcessedEvent],
          migrations: [
            InitIam1000000000000,
            HardenIam1000000000001,
            AddSchemaComments20260826000000,
          ],
          synchronize: false,
        }),
    }),
    CommonModule,
    AuthCommonModule,
    AuditModule,
    UserModule,
    AuthModule,
    AccessAuditModule,
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
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ResourceOwnershipGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
  exports: [UserModule, AuthModule],
})
export class IamBcModule {}
