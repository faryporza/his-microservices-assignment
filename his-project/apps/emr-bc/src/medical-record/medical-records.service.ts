import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { IdempotencyService, RMQ_CLIENT, StructuredLogger } from '@app/common';
import { MedicalRecord, RecordStatus } from './entities/medical-record.entity';
import { CreateMedicalRecordDTO } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDTO } from './dto/update-medical-record.dto';
import { CompleteTreatmentDTO } from './dto/complete-treatment.dto';
import {
  TREATMENT_COMPLETED_EVENT_NAME,
  TREATMENT_COMPLETED_EVENT_VERSION,
  TreatmentCompletedEvent,
  VisitCreatedEvent,
} from '@app/contracts';
import { randomUUID } from 'crypto';

@Injectable()
export class MedicalRecordsService {
  private readonly logger = new StructuredLogger('emr-bc');

  constructor(
    @InjectRepository(MedicalRecord)
    private readonly medicalRecordRepository: Repository<MedicalRecord>,
    @Inject(RMQ_CLIENT)
    private readonly client: ClientProxy,
    private readonly idempotency: IdempotencyService,
  ) {}

  async create(createDto: CreateMedicalRecordDTO): Promise<MedicalRecord> {
    if (
      createDto.treatment_cost !== undefined &&
      createDto.treatment_cost < 0
    ) {
      throw new BadRequestException('Treatment cost cannot be negative');
    }

    const record = this.medicalRecordRepository.create({
      ...createDto,
      status: createDto.status ?? RecordStatus.COMPLETED,
    });

    return await this.medicalRecordRepository.save(record);
  }

  async findAll(): Promise<MedicalRecord[]> {
    return await this.medicalRecordRepository.find();
  }

  async findOne(id: string): Promise<MedicalRecord> {
    const record = await this.medicalRecordRepository.findOne({
      where: { id },
    });
    if (!record) {
      throw new NotFoundException(`Medical record with ID '${id}' not found`);
    }
    return record;
  }

  async findByVisitId(visitId: string): Promise<MedicalRecord[]> {
    return await this.medicalRecordRepository.find({
      where: { visit_id: visitId },
    });
  }

  async update(
    id: string,
    updateDto: UpdateMedicalRecordDTO,
    correlationId?: string,
    traceId?: string,
  ): Promise<MedicalRecord> {
    const record = await this.findOne(id);

    if (
      updateDto.treatment_cost !== undefined &&
      updateDto.treatment_cost < 0
    ) {
      throw new BadRequestException('Treatment cost cannot be negative');
    }

    const previousStatus = record.status;

    Object.assign(record, updateDto);
    const saved = await this.medicalRecordRepository.save(record);

    if (
      previousStatus !== RecordStatus.COMPLETED &&
      saved.status === RecordStatus.COMPLETED
    ) {
      const eventCorrelationId =
        correlationId ?? saved.correlation_id ?? randomUUID();
      const event: TreatmentCompletedEvent = {
        metadata: {
          eventId: randomUUID(),
          eventName: TREATMENT_COMPLETED_EVENT_NAME,
          version: TREATMENT_COMPLETED_EVENT_VERSION,
          occurredAt: new Date().toISOString(),
          correlationId: eventCorrelationId,
          traceId: traceId ?? eventCorrelationId,
        },
        payload: {
          visitId: saved.visit_id,
          recordId: saved.id,
          treatmentCost:
            saved.treatment_cost != null
              ? String(saved.treatment_cost)
              : '0.00',
        },
      };

      try {
        await firstValueFrom(
          this.client.emit(TREATMENT_COMPLETED_EVENT_NAME, event),
        );
        this.logger.log({
          message: 'Domain event published',
          trace: {
            traceId: event.metadata.traceId,
            correlationId: event.metadata.correlationId,
          },
          context: {
            action: 'PUBLISH_EVENT',
            event_name: event.metadata.eventName,
            event_id: event.metadata.eventId,
            visit_id: event.payload.visitId,
            record_id: event.payload.recordId,
            event_status: 'PUBLISHED',
          },
        });
      } catch (error: unknown) {
        this.logger.error({
          message: 'Failed to publish domain event',
          trace: {
            traceId: event.metadata.traceId,
            correlationId: event.metadata.correlationId,
          },
          context: {
            action: 'PUBLISH_EVENT',
            event_name: event.metadata.eventName,
            event_id: event.metadata.eventId,
            visit_id: event.payload.visitId,
            record_id: event.payload.recordId,
            event_status: 'PUBLISH_FAILED',
          },
          error,
        });
        throw new ServiceUnavailableException('Message broker unavailable');
      }
    }

    return saved;
  }

  async processVisitCreated(event: VisitCreatedEvent): Promise<void> {
    await this.idempotency.process(
      event.metadata.eventId,
      event.metadata.eventName,
      async (manager) => {
        await this.createWaitingRecord(
          event.payload.visitId,
          event.payload.patientId,
          manager,
          event.metadata.correlationId,
        );
      },
    );
  }

  async completeTreatment(
    id: string,
    completeTreatmentDto: CompleteTreatmentDTO,
    correlationId?: string,
    traceId?: string,
  ): Promise<MedicalRecord> {
    return this.update(
      id,
      {
        ...completeTreatmentDto,
        status: RecordStatus.COMPLETED,
      },
      correlationId,
      traceId,
    );
  }

  async createWaitingRecord(
    visitId: string,
    patientId: string,
    manager?: EntityManager,
    correlationId?: string,
  ): Promise<MedicalRecord> {
    const repository = manager
      ? manager.getRepository(MedicalRecord)
      : this.medicalRecordRepository;
    const existingRecord = await repository.findOne({
      where: { visit_id: visitId },
    });

    if (existingRecord) {
      return existingRecord;
    }

    const recordData: Partial<MedicalRecord> = {
      visit_id: visitId,
      patient_id: patientId,
      status: RecordStatus.WAITING,
    };
    if (correlationId) {
      recordData.correlation_id = correlationId;
    }

    const record = repository.create(recordData);
    return repository.save(record);
  }
}
