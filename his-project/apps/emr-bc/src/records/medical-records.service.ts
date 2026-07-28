import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import {
  RABBITMQ_ROUTING_KEYS,
  TREATMENT_COMPLETED_EVENT_NAME,
  TREATMENT_COMPLETED_EVENT_VERSION,
  TreatmentCompletedEvent,
} from '@app/contracts';
import { randomUUID } from 'node:crypto';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { MedicalRecord, RecordStatus } from './entities/medical-record.entity';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { EMR_RMQ_CLIENT } from '../messaging/emr-rabbitmq.module';

@Injectable()
export class MedicalRecordsService {
  constructor(
    @InjectRepository(MedicalRecord)
    private readonly medicalRecordRepository: Repository<MedicalRecord>,
    @Inject(EMR_RMQ_CLIENT)
    private readonly rmqClient: ClientProxy,
  ) {}

  async create(createDto: CreateMedicalRecordDto): Promise<MedicalRecord> {
    if (createDto.treatmentCost !== undefined && createDto.treatmentCost < 0) {
      throw new BadRequestException('Treatment cost cannot be negative');
    }

    const record = this.medicalRecordRepository.create({
      ...createDto,
      status: createDto.status ?? RecordStatus.COMPLETED,
    });

    this.assertCompletedRecordIsValid(record);
    const savedRecord = await this.medicalRecordRepository.save(record);

    if (savedRecord.status === RecordStatus.COMPLETED) {
      await this.publishTreatmentCompleted(savedRecord);
    }

    return savedRecord;
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
  ): Promise<MedicalRecord> {
    const record = await this.findOne(id);

    if (updateDto.treatmentCost !== undefined && updateDto.treatmentCost < 0) {
      throw new BadRequestException('Treatment cost cannot be negative');
    }

    const previousStatus = record.status;
    Object.assign(record, updateDto);
    this.assertCompletedRecordIsValid(record);

    const savedRecord = await this.medicalRecordRepository.save(record);
    if (
      previousStatus !== RecordStatus.COMPLETED &&
      savedRecord.status === RecordStatus.COMPLETED
    ) {
      await this.publishTreatmentCompleted(savedRecord);
    }

    return savedRecord;
  }

  private assertCompletedRecordIsValid(record: MedicalRecord): void {
    if (record.status !== RecordStatus.COMPLETED) {
      return;
    }

    if (
      !record.diagnosis?.trim() ||
      !record.treatmentNote?.trim() ||
      !record.doctorId?.trim() ||
      record.treatmentCost === null ||
      record.treatmentCost === undefined
    ) {
      throw new BadRequestException(
        'Diagnosis, treatment note, doctor ID, and treatment cost are required to complete a record',
      );
    }

    const treatmentCost = Number(record.treatmentCost);
    if (!Number.isFinite(treatmentCost) || treatmentCost < 0) {
      throw new BadRequestException('Treatment cost cannot be negative');
    }
  }

  private async publishTreatmentCompleted(
    record: MedicalRecord,
  ): Promise<void> {
    const event: TreatmentCompletedEvent = {
      metadata: {
        eventId: randomUUID(),
        eventName: TREATMENT_COMPLETED_EVENT_NAME,
        version: TREATMENT_COMPLETED_EVENT_VERSION,
        occurredAt: new Date().toISOString(),
      },
      payload: {
        visitId: record.visitId,
        recordId: record.id,
        treatmentCost: Number(record.treatmentCost),
      },
    };

    await firstValueFrom(
      this.rmqClient.emit(RABBITMQ_ROUTING_KEYS.treatmentCompleted, event),
    );
  }
}
