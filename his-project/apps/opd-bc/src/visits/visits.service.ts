import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { IdempotencyService, RMQ_CLIENT, StructuredLogger } from '@app/common';
import { Visit, VisitStatus } from './entities/visit.entity';
import { Patient } from '../patients/entities/patient.entity';
import { CreateVisitDto } from './dto/create-visit.dto';
import {
  VISIT_CREATED_EVENT_NAME,
  VISIT_CREATED_EVENT_VERSION,
  InvoicePaidEvent,
  VisitCreatedEvent,
} from '@app/contracts';
import { randomUUID } from 'crypto';

@Injectable()
export class VisitsService {
  private readonly logger = new StructuredLogger('opd-bc');

  constructor(
    @InjectRepository(Visit)
    private readonly visitRepository: Repository<Visit>,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @Inject(RMQ_CLIENT)
    private readonly client: ClientProxy,
    private readonly idempotency: IdempotencyService,
  ) {}

  // สร้าง visit ใหม่
  async create(
    createVisitDto: CreateVisitDto,
    correlationId?: string,
    traceId?: string,
  ): Promise<Visit> {
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

    const saved = await this.visitRepository.save(visit);
    const eventCorrelationId = correlationId ?? randomUUID();

    const event: VisitCreatedEvent = {
      metadata: {
        eventId: randomUUID(),
        eventName: VISIT_CREATED_EVENT_NAME,
        version: VISIT_CREATED_EVENT_VERSION,
        occurredAt: new Date().toISOString(),
        correlationId: eventCorrelationId,
        traceId: traceId ?? eventCorrelationId,
      },
      payload: {
        visitId: saved.id,
        patientId: saved.patientId,
        timestamp: saved.visitDate.toISOString(),
      },
    };

    try {
      await firstValueFrom(this.client.emit(VISIT_CREATED_EVENT_NAME, event));
      this.logger.log({
        message: 'Domain event published',
        trace: {
          traceId: event.metadata.traceId,
          correlationId: event.metadata.correlationId,
        },
        context: {
          action: 'PUBLISH_EVENT',
          event_name: event.metadata.eventName,
          event_id: event.metadata.eventId,
          visit_id: saved.id,
          event_status: 'PUBLISHED',
        },
      });
    } catch (error: unknown) {
      this.logger.error({
        message: 'Failed to publish domain event',
        trace: {
          traceId: event.metadata.traceId,
          correlationId: event.metadata.correlationId,
        },
        context: {
          action: 'PUBLISH_EVENT',
          event_name: event.metadata.eventName,
          event_id: event.metadata.eventId,
          visit_id: saved.id,
          event_status: 'PUBLISH_FAILED',
        },
        error,
      });
      throw new ServiceUnavailableException('Message broker unavailable');
    }

    return saved;
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

  async processInvoicePaid(event: InvoicePaidEvent): Promise<void> {
    await this.idempotency.process(
      event.metadata.eventId,
      event.metadata.eventName,
      async (manager) => {
        await this.closeAfterPayment(event.payload.visitId, manager);
      },
    );
  }

  async closeAfterPayment(
    visitId: string,
    manager?: EntityManager,
  ): Promise<Visit> {
    const repository = manager
      ? manager.getRepository(Visit)
      : this.visitRepository;
    const visit = await repository.findOne({ where: { id: visitId } });

    if (!visit) {
      throw new NotFoundException(`Visit with ID '${visitId}' not found`);
    }

    if (visit.status === VisitStatus.CLOSED) {
      return visit;
    }

    visit.status = VisitStatus.CLOSED;
    return repository.save(visit);
  }
}
