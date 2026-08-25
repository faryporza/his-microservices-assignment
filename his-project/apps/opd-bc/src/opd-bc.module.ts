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
import { OpdHealthChecksController } from './health-checks.controller';
import { OpdHealthChecksService } from './health-checks.service';
import { PatientModule } from '@apps/opd-bc/modules/patient/patient.module';
import { VisitModule } from '@apps/opd-bc/modules/visit/visit.module';

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
        createPostgresOptions(configService, 'OPD_DATABASE'),
    }),
    CommonModule,
    AuthCommonModule,
    PatientModule,
    VisitModule,
  ],
  controllers: [OpdHealthChecksController],
  providers: [
    OpdHealthChecksService,
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
export class OpdBcModule {}
