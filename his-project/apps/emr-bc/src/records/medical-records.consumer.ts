import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { MedicalRecordsService } from './medical-records.service';
import type { VisitCreatedEvent } from '@app/contracts';
import { VISIT_CREATED_EVENT_NAME } from '@app/contracts';
import { RecordStatus } from './entities/medical-record.entity';

/**
 * Consumes `visit.created` events from OPD and creates a medical record stub
 * with status `WAITING` so the EMR workflow can begin.
 */
@Controller()
export class MedicalRecordsConsumer {
  constructor(private readonly service: MedicalRecordsService) {}

  @EventPattern(VISIT_CREATED_EVENT_NAME)
  async handleVisitCreated(@Payload() event: VisitCreatedEvent): Promise<void> {
    await this.service.create({
      visitId: event.payload.visitId,
      patientId: event.payload.patientId,
      doctorId: '00000000-0000-0000-0000-000000000000', // placeholder
      diagnosis: 'Pending',
      treatmentCost: 0,
      status: RecordStatus.WAITING,
    });
  }
}