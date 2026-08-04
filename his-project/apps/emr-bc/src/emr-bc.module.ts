import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createPostgresOptions } from '@app/common';
import { EmrBcController } from './emr-bc.controller';
import { EmrBcService } from './emr-bc.service';
import { MedicalRecordModule } from '@apps/emr-bc/medical-record/medical-record.module';
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
  controllers: [EmrBcController],
  providers: [EmrBcService],
})
export class EmrBcModule {}
