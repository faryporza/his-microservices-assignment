import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MedicalRecord, RecordStatus } from './entities/medical-record.entity';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';

@Injectable()
export class MedicalRecordsService {
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
}
