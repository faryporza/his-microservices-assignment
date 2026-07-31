import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from './entities/patient.entity';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
  ) {}

  // สร้าง patient ใหม่
  async create(createPatientDto: CreatePatientDto): Promise<Patient> {
    // ตรวจสอบว่า HN และ ID Card ซ้ำหรือไม่
    const existingHn = await this.patientRepository.findOne({
      where: { hn: createPatientDto.hn },
    });
    if (existingHn) {
      throw new ConflictException(`HN '${createPatientDto.hn}' already exists`);
    }

    const existingIdCard = await this.patientRepository.findOne({
      where: { idCard: createPatientDto.idCard },
    });
    if (existingIdCard) {
      throw new ConflictException(
        `ID Card '${createPatientDto.idCard}' already exists`,
      );
    }

    const patient = this.patientRepository.create(createPatientDto);
    return await this.patientRepository.save(patient);
  }

  // ดึงข้อมูล patient ทั้งหมด
  async findAll(): Promise<Patient[]> {
    return await this.patientRepository.find();
  }

  // ดึงข้อมูล patient ตาม id
  async findOne(id: string): Promise<Patient> {
    const patient = await this.patientRepository.findOne({ where: { id } });
    if (!patient) {
      throw new NotFoundException(`Patient with ID '${id}' not found`);
    }
    return patient;
  }

  async update(
    id: string,
    updatePatientDto: UpdatePatientDto,
  ): Promise<Patient> {
    const patient = await this.findOne(id);

    if (updatePatientDto.hn && updatePatientDto.hn !== patient.hn) {
      const existingHn = await this.patientRepository.findOne({
        where: { hn: updatePatientDto.hn },
      });
      if (existingHn) {
        throw new ConflictException(
          `HN '${updatePatientDto.hn}' already exists`,
        );
      }
    }

    if (updatePatientDto.idCard && updatePatientDto.idCard !== patient.idCard) {
      const existingIdCard = await this.patientRepository.findOne({
        where: { idCard: updatePatientDto.idCard },
      });
      if (existingIdCard) {
        throw new ConflictException(
          `ID Card '${updatePatientDto.idCard}' already exists`,
        );
      }
    }

    Object.assign(patient, updatePatientDto);
    return this.patientRepository.save(patient);
  }
}
