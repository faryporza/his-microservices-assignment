import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { MedicalRecord, RecordStatus } from './entities/medical-record.entity';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import {
  TREATMENT_COMPLETED_EVENT_NAME,
  TREATMENT_COMPLETED_EVENT_VERSION,
  TreatmentCompletedEvent,
} from '@app/contracts';
import { randomUUID } from 'crypto';

@Injectable()
export class MedicalRecordsService {
  constructor(
    @InjectRepository(MedicalRecord)
    private readonly medicalRecordRepository: Repository<MedicalRecord>,
    @Inject('RMQ_CLIENT')
    private readonly client: ClientProxy,
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
        },
        payload: {
          visitId: saved.visitId,
          recordId: saved.id,
          treatmentCost:
            saved.treatmentCost != null
              ? String(saved.treatmentCost)
              : '0.00',
        },
      };

      this.client.emit(TREATMENT_COMPLETED_EVENT_NAME, event);
    }

    return saved;
  }
}
