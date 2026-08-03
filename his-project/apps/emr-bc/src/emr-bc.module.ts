import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createPostgresOptions } from '@app/common';
import { EmrBcController } from './emr-bc.controller';
import { EmrBcService } from './emr-bc.service';
import { MedicalRecordsModule } from './records/medical-records.module';
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
    MedicalRecordsModule,
  ],
  controllers: [EmrBcController],
  providers: [EmrBcService],
})
export class EmrBcModule {}
