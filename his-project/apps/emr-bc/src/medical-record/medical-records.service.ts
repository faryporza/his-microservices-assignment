import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  IdempotencyService,
  OutboxEventsService,
  StructuredLogger,
} from '@app/common';
import { MedicalRecord, RecordStatus } from './entities/medical-record.entity';
import { CreateMedicalRecordDTO } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDTO } from './dto/update-medical-record.dto';
import { CompleteTreatmentDTO } from './dto/complete-treatment.dto';
import {
  treatmentCompletedEventName,
  treatmentCompletedEventVersion,
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
    private readonly outboxEvents: OutboxEventsService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async create(createDto: CreateMedicalRecordDTO): Promise<MedicalRecord> {
    const { saved, event } = await this.outboxEvents.runInTransaction(
      async (manager) => {
        this.validateTreatmentCost(createDto.treatment_cost);
        const repository = manager.getRepository(MedicalRecord);
        const record = repository.create({
          ...createDto,
          status: createDto.status ?? RecordStatus.COMPLETED,
        });
        const saved = await repository.save(record);
        const event =
          saved.status === RecordStatus.COMPLETED
            ? await this.enqueueTreatmentCompleted(
                manager,
                saved,
                undefined,
                undefined,
              )
            : undefined;
        return { saved, event };
      },
    );

    if (event) {
      await this.outboxEvents.publishPending();
      this.logEventQueued(event);
    }

    return saved;
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
    const { saved, event } = await this.outboxEvents.runInTransaction(
      async (manager) => {
        const repository = manager.getRepository(MedicalRecord);
        const record = await repository.findOne({ where: { id } });
        if (!record) {
          throw new NotFoundException(
            `Medical record with ID '${id}' not found`,
          );
        }

        this.validateTreatmentCost(updateDto.treatment_cost);
        const previousStatus = record.status;
        Object.assign(record, updateDto);
        const saved = await repository.save(record);
        const event =
          previousStatus !== RecordStatus.COMPLETED &&
          saved.status === RecordStatus.COMPLETED
            ? await this.enqueueTreatmentCompleted(
                manager,
                saved,
                correlationId,
                traceId,
              )
            : undefined;
        return { saved, event };
      },
    );

    if (event) {
      await this.outboxEvents.publishPending();
      this.logEventQueued(event);
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

  private validateTreatmentCost(treatmentCost?: number): void {
    if (treatmentCost !== undefined && treatmentCost < 0) {
      throw new BadRequestException('Treatment cost cannot be negative');
    }
  }

  private async enqueueTreatmentCompleted(
    manager: EntityManager,
    record: MedicalRecord,
    correlationId?: string,
    traceId?: string,
  ): Promise<TreatmentCompletedEvent> {
    const eventCorrelationId =
      correlationId ?? record.correlation_id ?? randomUUID();
    const event: TreatmentCompletedEvent = {
      metadata: {
        eventId: randomUUID(),
        eventName: treatmentCompletedEventName,
        version: treatmentCompletedEventVersion,
        occurredAt: new Date().toISOString(),
        correlationId: eventCorrelationId,
        traceId: traceId ?? eventCorrelationId,
      },
      payload: {
        visitId: record.visit_id,
        recordId: record.id,
        treatmentCost:
          record.treatment_cost != null
            ? String(record.treatment_cost)
            : '0.00',
      },
    };

    await this.outboxEvents.enqueue(
      manager,
      treatmentCompletedEventName,
      event,
    );
    return event;
  }

  private logEventQueued(event: TreatmentCompletedEvent): void {
    this.logger.log({
      message: 'Domain event queued',
      trace: {
        traceId: event.metadata.traceId,
        correlationId: event.metadata.correlationId,
      },
      context: {
        action: 'QUEUE_EVENT',
        event_name: event.metadata.eventName,
        event_id: event.metadata.eventId,
        visit_id: event.payload.visitId,
        record_id: event.payload.recordId,
        event_status: 'QUEUED',
      },
    });
  }
}
