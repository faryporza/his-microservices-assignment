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
  InitEmr1000000000000,
  AddSchemaComments20260826000000,
} from '@app/common';
import { EmrHealthChecksController } from './health-checks.controller';
import { EmrHealthChecksService } from './health-checks.service';
import { MedicalRecordModule } from '@apps/emr-bc/modules/medical-record/medical-record.module';
import { MedicalRecord } from '@apps/emr-bc/modules/medical-record/entities/medical-record.entity';

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
        createPostgresOptions(configService, 'EMR_DATABASE', {
          entities: [MedicalRecord, OutboxEvent, ProcessedEvent],
          migrations: [InitEmr1000000000000, AddSchemaComments20260826000000],
          synchronize: false,
        }),
    }),
    CommonModule,
    AuthCommonModule,
    AuditModule,
    MedicalRecordModule,
  ],
  controllers: [EmrHealthChecksController],
  providers: [
    EmrHealthChecksService,
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
})
export class EmrBcModule {}
