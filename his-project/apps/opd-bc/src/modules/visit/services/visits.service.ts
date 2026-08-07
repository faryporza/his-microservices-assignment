import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  IdempotencyService,
  OutboxEventsService,
  StructuredLogger,
} from '@app/common';
import { Visit, VisitStatus } from '../entities/visit.entity';
import { Patient } from '@apps/opd-bc/modules/patient/entities/patient.entity';
import { CreateVisitDTO } from '../dto/create-visit.dto';
import {
  visitCreatedEventName,
  visitCreatedEventVersion,
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
    private readonly outboxEvents: OutboxEventsService,
    private readonly idempotency: IdempotencyService,
  ) {}

  // สร้าง visit ใหม่
  async create(
    createVisitDto: CreateVisitDTO,
    correlationId?: string,
    traceId?: string,
  ): Promise<Visit> {
    const { saved, event } = await this.outboxEvents.runInTransaction(
      async (manager) => {
        const patientRepository = manager.getRepository(Patient);
        const patient = await patientRepository.findOne({
          where: { id: createVisitDto.patient_id },
        });
        if (!patient) {
          throw new NotFoundException(
            `Patient with ID '${createVisitDto.patient_id}' not found`,
          );
        }

        const repository = manager.getRepository(Visit);
        const visit = repository.create({
          patient_id: createVisitDto.patient_id,
          status: VisitStatus.OPEN,
        });
        const saved = await repository.save(visit);
        const eventCorrelationId = correlationId ?? randomUUID();
        const event: VisitCreatedEvent = {
          metadata: {
            eventId: randomUUID(),
            eventName: visitCreatedEventName,
            version: visitCreatedEventVersion,
            occurredAt: new Date().toISOString(),
            correlationId: eventCorrelationId,
            traceId: traceId ?? eventCorrelationId,
          },
          payload: {
            visitId: saved.id,
            patientId: saved.patient_id,
            timestamp: saved.visit_date.toISOString(),
          },
        };

        await this.outboxEvents.enqueue(manager, visitCreatedEventName, event);
        return { saved, event };
      },
    );

    await this.outboxEvents.publishPending();
    this.logger.log({
      message: 'Domain event queued',
      trace: {
        traceId: event.metadata.traceId,
        correlationId: event.metadata.correlationId,
      },
      context: {
        action: 'QUEUE_EVENT',
        event_name: event.metadata.eventName,
        event_id: event.metadata.eventId,
        visit_id: saved.id,
        event_status: 'QUEUED',
      },
    });

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
      where: { patient_id: patientId },
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
