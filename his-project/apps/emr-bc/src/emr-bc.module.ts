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
} from '@app/common';
import { EmrHealthChecksController } from './health-checks.controller';
import { EmrHealthChecksService } from './health-checks.service';
import { MedicalRecordModule } from '@apps/emr-bc/modules/medical-record/medical-record.module';

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
        createPostgresOptions(configService, 'EMR_DATABASE'),
    }),
    CommonModule,
    AuthCommonModule,
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
  ],
})
export class EmrBcModule {}
