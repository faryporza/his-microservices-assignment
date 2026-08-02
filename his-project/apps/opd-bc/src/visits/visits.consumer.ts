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
export class VisitsConsumer {
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
      this.logger.error({
        eventName: INVOICE_PAID_EVENT_NAME,
        eventId: getEventIdForLog(event),
        status: 'DISCARDED',
        error: 'InvalidEvent',
      });
      channel.nack(message, false, false);
      return;
    }

    try {
      await this.service.processInvoicePaid(event);
      channel.ack(message);
      this.logger.log({
        eventName: event.metadata.eventName,
        eventId: event.metadata.eventId,
        correlationId: event.metadata.correlationId,
        visitId: event.payload.visitId,
        status: 'ACKED',
      });
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        this.logger.error({
          eventName: event.metadata.eventName,
          eventId: event.metadata.eventId,
          correlationId: event.metadata.correlationId,
          visitId: event.payload.visitId,
          status: 'DISCARDED',
          error,
        });
        channel.nack(message, false, false);
        return;
      }

      this.logger.error({
        eventName: event.metadata.eventName,
        eventId: event.metadata.eventId,
        correlationId: event.metadata.correlationId,
        visitId: event.payload.visitId,
        status: 'REQUEUED',
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
