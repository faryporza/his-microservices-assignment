import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Visit } from './entities/visit.entity';
import { Patient } from '@apps/opd-bc/patient/entities/patient.entity';
import { VisitsService } from './visits.service';
import { VisitsController } from './visits.controller';
import { VisitEventsController } from './visit-events.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Visit, Patient])],
  controllers: [VisitsController, VisitEventsController],
  providers: [VisitsService],
  exports: [VisitsService],
})
export class VisitModule {}
