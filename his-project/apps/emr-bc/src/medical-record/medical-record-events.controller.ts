import { BadRequestException, Controller } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { StructuredLogger } from '@app/common';
import { MedicalRecordsService } from './medical-records.service';
import {
  hasValidEventMetadata,
  getEventIdForLog,
  isUuidV4,
  VISIT_CREATED_EVENT_NAME,
  VISIT_CREATED_EVENT_VERSION,
  VisitCreatedEvent,
} from '@app/contracts';
import type { Channel, ConsumeMessage } from 'amqplib';

/**
 * Consumes `visit.created` events from OPD and creates a medical record stub
 * with status `WAITING` so the EMR workflow can begin.
 */
@Controller()
export class MedicalRecordEventsController {
  private readonly logger = new StructuredLogger('emr-bc');

  constructor(private readonly service: MedicalRecordsService) {}

  @EventPattern(VISIT_CREATED_EVENT_NAME)
  async handleVisitCreated(
    @Payload() event: unknown,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    const channel = context.getChannelRef() as Channel;
    const message = context.getMessage() as ConsumeMessage;

    if (!this.isVisitCreatedEvent(event)) {
      this.logger.warn({
        message: 'Invalid domain event discarded',
        context: {
          action: 'CONSUME_EVENT',
          event_name: VISIT_CREATED_EVENT_NAME,
          event_id: getEventIdForLog(event),
          event_status: 'DISCARDED',
          error_type: 'InvalidEvent',
        },
      });
      channel.nack(message, false, false);
      return;
    }

    try {
      await this.service.processVisitCreated(event);
      channel.ack(message);
      this.logger.log({
        message: 'Domain event processed',
        trace: {
          traceId: event.metadata.traceId,
          correlationId: event.metadata.correlationId,
        },
        context: {
          action: 'CONSUME_EVENT',
          event_name: event.metadata.eventName,
          event_id: event.metadata.eventId,
          visit_id: event.payload.visitId,
          event_status: 'ACKED',
        },
      });
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        this.logger.warn({
          message: 'Domain event discarded',
          trace: {
            traceId: event.metadata.traceId,
            correlationId: event.metadata.correlationId,
          },
          context: {
            action: 'CONSUME_EVENT',
            event_name: event.metadata.eventName,
            event_id: event.metadata.eventId,
            visit_id: event.payload.visitId,
            event_status: 'DISCARDED',
          },
          error,
        });
        channel.nack(message, false, false);
        return;
      }

      this.logger.error({
        message: 'Domain event processing failed',
        trace: {
          traceId: event.metadata.traceId,
          correlationId: event.metadata.correlationId,
        },
        context: {
          action: 'CONSUME_EVENT',
          event_name: event.metadata.eventName,
          event_id: event.metadata.eventId,
          visit_id: event.payload.visitId,
          event_status: 'REQUEUED',
        },
        error,
      });
      channel.nack(message, false, true);
      throw error;
    }
  }

  private isVisitCreatedEvent(event: unknown): event is VisitCreatedEvent {
    if (typeof event !== 'object' || event === null) {
      return false;
    }

    const candidate = event as Partial<VisitCreatedEvent>;
    const payload = candidate.payload;
    return (
      hasValidEventMetadata(
        candidate.metadata,
        VISIT_CREATED_EVENT_NAME,
        VISIT_CREATED_EVENT_VERSION,
      ) &&
      isUuidV4(payload?.visitId) &&
      isUuidV4(payload.patientId) &&
      typeof payload.timestamp === 'string' &&
      !Number.isNaN(Date.parse(payload.timestamp))
    );
  }
}
