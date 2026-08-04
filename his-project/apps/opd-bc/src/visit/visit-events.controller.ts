import { Controller, NotFoundException } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import {
  hasValidEventMetadata,
  getEventIdForLog,
  INVOICE_PAID_EVENT_NAME,
  INVOICE_PAID_EVENT_VERSION,
  InvoicePaidEvent,
  isUuidV4,
} from '@app/contracts';
import type { Channel, ConsumeMessage } from 'amqplib';
import { StructuredLogger } from '@app/common';
import { VisitsService } from './visits.service';

/**
 * Consumes `invoice.paid` events from Finance and closes the corresponding
 * visit. Idempotent: a visit that is already `CLOSED` remains closed on
 * duplicate events.
 */
@Controller()
export class VisitEventsController {
  private readonly logger = new StructuredLogger('opd-bc');

  constructor(private readonly service: VisitsService) {}

  @EventPattern(INVOICE_PAID_EVENT_NAME)
  async handleInvoicePaid(
    @Payload() event: unknown,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    const channel = context.getChannelRef() as Channel;
    const message = context.getMessage() as ConsumeMessage;

    if (!this.isInvoicePaidEvent(event)) {
      this.logger.warn({
        message: 'Invalid domain event discarded',
        context: {
          action: 'CONSUME_EVENT',
          event_name: INVOICE_PAID_EVENT_NAME,
          event_id: getEventIdForLog(event),
          event_status: 'DISCARDED',
          error_type: 'InvalidEvent',
        },
      });
      channel.nack(message, false, false);
      return;
    }

    try {
      await this.service.processInvoicePaid(event);
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
          invoice_id: event.payload.invoiceId,
          event_status: 'ACKED',
        },
      });
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
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
            invoice_id: event.payload.invoiceId,
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
          invoice_id: event.payload.invoiceId,
          event_status: 'REQUEUED',
        },
        error,
      });
      channel.nack(message, false, true);
      throw error;
    }
  }

  private isInvoicePaidEvent(event: unknown): event is InvoicePaidEvent {
    if (typeof event !== 'object' || event === null) {
      return false;
    }

    const candidate = event as Partial<InvoicePaidEvent>;
    const payload = candidate.payload;
    return (
      hasValidEventMetadata(
        candidate.metadata,
        INVOICE_PAID_EVENT_NAME,
        INVOICE_PAID_EVENT_VERSION,
      ) &&
      isUuidV4(payload?.visitId) &&
      isUuidV4(payload.invoiceId) &&
      payload.status === 'PAID'
    );
  }
}
