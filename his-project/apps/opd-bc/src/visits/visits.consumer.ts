import { Controller, Logger, NotFoundException } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import {
  INVOICE_PAID_EVENT_NAME,
  INVOICE_PAID_EVENT_VERSION,
  InvoicePaidEvent,
} from '@app/contracts';
import type { Channel, ConsumeMessage } from 'amqplib';
import { VisitsService } from './visits.service';

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Controller()
export class VisitsConsumer {
  private readonly logger = new Logger(VisitsConsumer.name);

  constructor(private readonly visitsService: VisitsService) {}

  @EventPattern(INVOICE_PAID_EVENT_NAME)
  async handleInvoicePaid(
    @Payload() event: unknown,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    const channel = context.getChannelRef() as Channel;
    const message = context.getMessage() as ConsumeMessage;

    if (!this.isInvoicePaidEvent(event)) {
      this.logger.error('Discarding invalid invoice.paid event');
      channel.nack(message, false, false);
      return;
    }

    try {
      await this.visitsService.closeAfterPayment(event.payload.visitId);
      channel.ack(message);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        this.logger.error(
          `Discarding invoice.paid for missing visit ${event.payload.visitId}`,
        );
        channel.nack(message, false, false);
        return;
      }

      this.logger.error(
        `Failed to close visit ${event.payload.visitId}`,
        error instanceof Error ? error.stack : undefined,
      );
      channel.nack(message, false, true);
      throw error;
    }
  }

  private isInvoicePaidEvent(event: unknown): event is InvoicePaidEvent {
    if (typeof event !== 'object' || event === null) {
      return false;
    }

    const candidate = event as Partial<InvoicePaidEvent>;
    const metadata = candidate.metadata;
    const payload = candidate.payload;

    return (
      metadata?.eventName === INVOICE_PAID_EVENT_NAME &&
      metadata.version === INVOICE_PAID_EVENT_VERSION &&
      typeof metadata.eventId === 'string' &&
      UUID_V4_PATTERN.test(metadata.eventId) &&
      typeof metadata.occurredAt === 'string' &&
      !Number.isNaN(Date.parse(metadata.occurredAt)) &&
      typeof payload?.visitId === 'string' &&
      UUID_V4_PATTERN.test(payload.visitId) &&
      typeof payload.invoiceId === 'string' &&
      UUID_V4_PATTERN.test(payload.invoiceId) &&
      payload.status === 'PAID'
    );
  }
}
