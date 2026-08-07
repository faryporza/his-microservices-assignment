import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Visit } from './entities/visit.entity';
import { Patient } from '@apps/opd-bc/modules/patient/entities/patient.entity';
import { VisitsService } from './services/visits.service';
import { VisitsController } from './controllers/visits.controller';
import { VisitEventsController } from './controllers/visit-events.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Visit, Patient])],
  controllers: [VisitsController, VisitEventsController],
  providers: [VisitsService],
  exports: [VisitsService],
})
export class VisitModule {}
