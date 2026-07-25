import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from './entities/patient.entity';
import { CreatePatientDto } from './dto/create-patient.dto';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
  ) {}

  async create(createPatientDto: CreatePatientDto): Promise<Patient> {
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

  async findAll(): Promise<Patient[]> {
    return await this.patientRepository.find();
  }

  async findOne(id: string): Promise<Patient> {
    const patient = await this.patientRepository.findOne({ where: { id } });
    if (!patient) {
      throw new NotFoundException(`Patient with ID '${id}' not found`);
    }
    return patient;
  }
}
