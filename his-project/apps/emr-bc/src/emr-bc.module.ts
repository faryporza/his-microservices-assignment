import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createPostgresOptions } from '@app/common';
import { EmrHealthChecksController } from './health-checks.controller';
import { EmrHealthChecksService } from './health-checks.service';
import { MedicalRecordModule } from '@apps/emr-bc/modules/medical-record/medical-record.module';
import { CommonModule } from '@app/common';

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
    MedicalRecordModule,
  ],
  controllers: [EmrHealthChecksController],
  providers: [EmrHealthChecksService],
})
export class EmrBcModule {}
