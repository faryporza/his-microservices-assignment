import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicalRecord } from './entities/medical-record.entity';
import { MedicalRecordsService } from './medical-records.service';
import { MedicalRecordsController } from './medical-records.controller';
import { MedicalRecordEventsController } from './medical-record-events.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MedicalRecord])],
  controllers: [MedicalRecordsController, MedicalRecordEventsController],
  providers: [MedicalRecordsService],
  exports: [MedicalRecordsService, TypeOrmModule],
})
export class MedicalRecordModule {}
