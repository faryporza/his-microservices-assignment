import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { MedicalRecord, RecordStatus } from './entities/medical-record.entity';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';

@Injectable()
export class MedicalRecordsService {
  private readonly logger = new Logger(MedicalRecordsService.name);

  constructor(
    @InjectRepository(MedicalRecord)
    private readonly medicalRecordRepository: Repository<MedicalRecord>,
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

  async createWaitingRecord(
    visitId: string,
    patientId: string,
  ): Promise<MedicalRecord> {
    const existingRecord = await this.medicalRecordRepository.findOne({
      where: { visitId },
    });

    if (existingRecord) {
      this.logger.log(
        `Skipping visit.created for visit ${visitId}: medical record already exists`,
      );
      return existingRecord;
    }

    const record = this.medicalRecordRepository.create({
      visitId,
      patientId,
      status: RecordStatus.WAITING,
    });

    try {
      return await this.medicalRecordRepository.save(record);
    } catch (error: unknown) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }

      const concurrentRecord = await this.medicalRecordRepository.findOne({
        where: { visitId },
      });
      if (!concurrentRecord) {
        throw error;
      }

      this.logger.log(
        `Skipping visit.created for visit ${visitId}: medical record was created concurrently`,
      );
      return concurrentRecord;
    }
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

    Object.assign(record, updateDto);
    return await this.medicalRecordRepository.save(record);
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    return (error.driverError as { code?: string }).code === '23505';
  }
}
