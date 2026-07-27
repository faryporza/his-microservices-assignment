import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import {
  VISIT_CREATED_EVENT_NAME,
  VISIT_CREATED_EVENT_VERSION,
  VisitCreatedEvent,
} from '@app/contracts';
import type { Channel, ConsumeMessage } from 'amqplib';
import { MedicalRecordsService } from './medical-records.service';

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Controller()
export class MedicalRecordsConsumer {
  private readonly logger = new Logger(MedicalRecordsConsumer.name);

  constructor(private readonly medicalRecordsService: MedicalRecordsService) {}

  @EventPattern(VISIT_CREATED_EVENT_NAME)
  async handleVisitCreated(
    @Payload() event: unknown,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    const channel = context.getChannelRef() as Channel;
    const message = context.getMessage() as ConsumeMessage;

    if (!this.isVisitCreatedEvent(event)) {
      this.logger.error('Discarding invalid visit.created event');
      channel.nack(message, false, false);
      return;
    }

    this.logger.log(
      `Received visit.created for visit ${event.payload.visitId}`,
    );

    try {
      await this.medicalRecordsService.createWaitingRecord(
        event.payload.visitId,
        event.payload.patientId,
      );
      channel.ack(message);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to consume visit.created for visit ${event.payload.visitId}`,
        error instanceof Error ? error.stack : undefined,
      );
      channel.nack(message, false, true);
      throw error;
    }
  }

  private isVisitCreatedEvent(event: unknown): event is VisitCreatedEvent {
    if (typeof event !== 'object' || event === null) {
      return false;
    }

    const candidate = event as Partial<VisitCreatedEvent>;
    const metadata = candidate.metadata;
    const payload = candidate.payload;

    return (
      metadata?.eventName === VISIT_CREATED_EVENT_NAME &&
      metadata.version === VISIT_CREATED_EVENT_VERSION &&
      typeof metadata.eventId === 'string' &&
      metadata.eventId.length > 0 &&
      typeof metadata.occurredAt === 'string' &&
      !Number.isNaN(Date.parse(metadata.occurredAt)) &&
      typeof payload?.visitId === 'string' &&
      UUID_V4_PATTERN.test(payload.visitId) &&
      typeof payload.patientId === 'string' &&
      UUID_V4_PATTERN.test(payload.patientId) &&
      typeof payload.timestamp === 'string' &&
      !Number.isNaN(Date.parse(payload.timestamp))
    );
  }
}
