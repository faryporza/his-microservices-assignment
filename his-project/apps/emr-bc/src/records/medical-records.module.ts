import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicalRecord } from './entities/medical-record.entity';
import { MedicalRecordsService } from './medical-records.service';
import { MedicalRecordsController } from './medical-records.controller';
import { EmrRabbitMqModule } from '../messaging/emr-rabbitmq.module';

@Module({
  imports: [TypeOrmModule.forFeature([MedicalRecord]), EmrRabbitMqModule],
  controllers: [MedicalRecordsController],
  providers: [MedicalRecordsService],
  exports: [MedicalRecordsService, TypeOrmModule],
})
export class MedicalRecordsModule {}
