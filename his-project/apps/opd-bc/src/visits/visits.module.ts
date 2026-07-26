import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Visit } from './entities/visit.entity';
import { Patient } from '../patients/entities/patient.entity';
import { VisitsService } from './visits.service';
import { VisitsController } from './visits.controller';
import { VisitsConsumer } from './visits.consumer';

@Module({
  imports: [TypeOrmModule.forFeature([Visit, Patient])],
  controllers: [VisitsController, VisitsConsumer],
  providers: [VisitsService],
  exports: [VisitsService],
})
export class VisitsModule {}
