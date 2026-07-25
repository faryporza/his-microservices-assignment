import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Visit, VisitStatus } from './entities/visit.entity';
import { Patient } from '../patients/entities/patient.entity';
import { CreateVisitDto } from './dto/create-visit.dto';

@Injectable()
export class VisitsService {
  constructor(
    @InjectRepository(Visit)
    private readonly visitRepository: Repository<Visit>,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
  ) {}

  // สร้าง visit ใหม่
  async create(createVisitDto: CreateVisitDto): Promise<Visit> {
    const patient = await this.patientRepository.findOne({
      where: { id: createVisitDto.patientId },
    });
    if (!patient) {
      throw new NotFoundException(
        `Patient with ID '${createVisitDto.patientId}' not found`,
      );
    }

    const visit = this.visitRepository.create({
      patientId: createVisitDto.patientId,
      status: VisitStatus.OPEN,
    });

    return await this.visitRepository.save(visit);
  }

  // ดึงข้อมูล visit ทั้งหมด
  async findAll(): Promise<Visit[]> {
    return await this.visitRepository.find({
      relations: { patient: true },
    });
  }

  // ดึงข้อมูล visit ตาม id
  async findOne(id: string): Promise<Visit> {
    const visit = await this.visitRepository.findOne({
      where: { id },
      relations: { patient: true },
    });
    if (!visit) {
      throw new NotFoundException(`Visit with ID '${id}' not found`);
    }
    return visit;
  }

  // ดึงข้อมูล visit ตาม patientId
  async findByPatientId(patientId: string): Promise<Visit[]> {
    const patient = await this.patientRepository.findOne({
      where: { id: patientId },
    });
    if (!patient) {
      throw new NotFoundException(`Patient with ID '${patientId}' not found`);
    }
    return await this.visitRepository.find({
      where: { patientId },
      relations: { patient: true },
    });
  }
}
