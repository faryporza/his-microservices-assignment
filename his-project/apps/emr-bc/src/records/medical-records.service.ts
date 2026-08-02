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
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { CompleteTreatmentDto } from './dto/complete-treatment.dto';
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

  async create(createDto: CreateMedicalRecordDto): Promise<MedicalRecord> {
    if (createDto.treatmentCost !== undefined && createDto.treatmentCost < 0) {
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
      where: { visitId },
    });
  }

  async update(
    id: string,
    updateDto: UpdateMedicalRecordDto,
    correlationId?: string,
  ): Promise<MedicalRecord> {
    const record = await this.findOne(id);

    if (updateDto.treatmentCost !== undefined && updateDto.treatmentCost < 0) {
      throw new BadRequestException('Treatment cost cannot be negative');
    }

    const previousStatus = record.status;

    Object.assign(record, updateDto);
    const saved = await this.medicalRecordRepository.save(record);

    if (
      previousStatus !== RecordStatus.COMPLETED &&
      saved.status === RecordStatus.COMPLETED
    ) {
      const event: TreatmentCompletedEvent = {
        metadata: {
          eventId: randomUUID(),
          eventName: TREATMENT_COMPLETED_EVENT_NAME,
          version: TREATMENT_COMPLETED_EVENT_VERSION,
          occurredAt: new Date().toISOString(),
          correlationId: correlationId ?? saved.correlationId ?? randomUUID(),
        },
        payload: {
          visitId: saved.visitId,
          recordId: saved.id,
          treatmentCost:
            saved.treatmentCost != null ? String(saved.treatmentCost) : '0.00',
        },
      };

      try {
        await firstValueFrom(
          this.client.emit(TREATMENT_COMPLETED_EVENT_NAME, event),
        );
        this.logger.log({
          eventName: event.metadata.eventName,
          eventId: event.metadata.eventId,
          correlationId: event.metadata.correlationId,
          visitId: event.payload.visitId,
          status: 'PUBLISHED',
        });
      } catch (error: unknown) {
        this.logger.error({
          eventName: event.metadata.eventName,
          eventId: event.metadata.eventId,
          correlationId: event.metadata.correlationId,
          visitId: event.payload.visitId,
          status: 'PUBLISH_FAILED',
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
    completeTreatmentDto: CompleteTreatmentDto,
    correlationId?: string,
  ): Promise<MedicalRecord> {
    return this.update(
      id,
      {
        ...completeTreatmentDto,
        status: RecordStatus.COMPLETED,
      },
      correlationId,
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
    const existingRecord = await repository.findOne({ where: { visitId } });

    if (existingRecord) {
      return existingRecord;
    }

    const recordData: Partial<MedicalRecord> = {
      visitId,
      patientId,
      status: RecordStatus.WAITING,
    };
    if (correlationId) {
      recordData.correlationId = correlationId;
    }

    const record = repository.create(recordData);
    return repository.save(record);
  }
}
