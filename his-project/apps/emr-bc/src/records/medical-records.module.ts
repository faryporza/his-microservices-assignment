import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicalRecord } from './entities/medical-record.entity';
import { MedicalRecordsService } from './medical-records.service';
import { MedicalRecordsController } from './medical-records.controller';
import { MedicalRecordsConsumer } from './medical-records.consumer';

@Module({
  imports: [TypeOrmModule.forFeature([MedicalRecord])],
  controllers: [MedicalRecordsController, MedicalRecordsConsumer],
  providers: [MedicalRecordsService],
  exports: [MedicalRecordsService, TypeOrmModule],
})
export class MedicalRecordsModule {}
