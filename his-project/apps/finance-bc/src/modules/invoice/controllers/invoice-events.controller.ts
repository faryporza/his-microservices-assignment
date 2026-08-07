import { BadRequestException, Controller } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { StructuredLogger } from '@app/common';
import { InvoicesService } from '../services/invoices.service';
import {
  hasValidEventMetadata,
  getEventIdForLog,
  isUuidV4,
  treatmentCompletedEventName,
  treatmentCompletedEventVersion,
  TreatmentCompletedEvent,
} from '@app/contracts';
import type { Channel, ConsumeMessage } from 'amqplib';

/**
 * Consumes `treatment.completed` events from EMR and creates a pending invoice
 * in Finance. The `treatmentCost` is carried as a string to preserve decimal
 * precision; the service normalizes it before persisting.
 */
@Controller()
export class InvoiceEventsController {
  private readonly logger = new StructuredLogger('finance-bc');

  constructor(private readonly service: InvoicesService) {}

  @EventPattern(treatmentCompletedEventName)
  async handleTreatmentCompleted(
    @Payload() event: unknown,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    const channel = context.getChannelRef() as Channel;
    const message = context.getMessage() as ConsumeMessage;

    if (!this.isTreatmentCompletedEvent(event)) {
      this.logger.warn({
        message: 'Invalid domain event discarded',
        context: {
          action: 'CONSUME_EVENT',
          event_name: treatmentCompletedEventName,
          event_id: getEventIdForLog(event),
          event_status: 'DISCARDED',
          error_type: 'InvalidEvent',
        },
      });
      channel.nack(message, false, false);
      return;
    }

    try {
      await this.service.processTreatmentCompleted(event);
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
          record_id: event.payload.recordId,
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
            record_id: event.payload.recordId,
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
          record_id: event.payload.recordId,
          event_status: 'REQUEUED',
        },
        error,
      });
      channel.nack(message, false, true);
      throw error;
    }
  }

  private isTreatmentCompletedEvent(
    event: unknown,
  ): event is TreatmentCompletedEvent {
    if (typeof event !== 'object' || event === null) {
      return false;
    }

    const candidate = event as Partial<TreatmentCompletedEvent>;
    const payload = candidate.payload;
    return (
      hasValidEventMetadata(
        candidate.metadata,
        treatmentCompletedEventName,
        treatmentCompletedEventVersion,
      ) &&
      isUuidV4(payload?.visitId) &&
      isUuidV4(payload.recordId) &&
      typeof payload.treatmentCost === 'string' &&
      /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(payload.treatmentCost)
    );
  }
}
