import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { randomUUID } from 'node:crypto';
import {
  RABBITMQ_ROUTING_KEYS,
  VISIT_CREATED_EVENT_NAME,
  VISIT_CREATED_EVENT_VERSION,
  VisitCreatedEvent,
} from '@app/contracts';
import { Visit, VisitStatus } from './entities/visit.entity';
import { Patient } from '../patients/entities/patient.entity';
import { CreateVisitDto } from './dto/create-visit.dto';
import { RMQ_CLIENT } from '../messaging/opd-rabbitmq.module';

@Injectable()
export class VisitsService {
  constructor(
    @InjectRepository(Visit)
    private readonly visitRepository: Repository<Visit>,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @Inject(RMQ_CLIENT)
    private readonly rmqClient: ClientProxy,
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

    const savedVisit = await this.visitRepository.save(visit);

    const event: VisitCreatedEvent = {
      metadata: {
        eventId: randomUUID(),
        eventName: VISIT_CREATED_EVENT_NAME,
        version: VISIT_CREATED_EVENT_VERSION,
        occurredAt: new Date().toISOString(),
      },
      payload: {
        visitId: savedVisit.id,
        patientId: savedVisit.patientId,
        timestamp: savedVisit.visitDate.toISOString(),
      },
    };

    await firstValueFrom(
      this.rmqClient.emit(RABBITMQ_ROUTING_KEYS.visitCreated, event),
    );

    return savedVisit;
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
