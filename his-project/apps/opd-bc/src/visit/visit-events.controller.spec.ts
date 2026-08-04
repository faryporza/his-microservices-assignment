import { Logger } from '@nestjs/common';
import { RmqContext } from '@nestjs/microservices';
import {
  INVOICE_PAID_EVENT_NAME,
  INVOICE_PAID_EVENT_VERSION,
  InvoicePaidEvent,
} from '@app/contracts';
import { VisitEventsController } from './visit-events.controller';
import { VisitsService } from './visits.service';

describe('VisitEventsController', () => {
  const event: InvoicePaidEvent = {
    metadata: {
      eventId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      eventName: INVOICE_PAID_EVENT_NAME,
      version: INVOICE_PAID_EVENT_VERSION,
      occurredAt: '2026-08-01T00:00:00.000Z',
    },
    payload: {
      visitId: '550e8400-e29b-41d4-a716-446655440000',
      invoiceId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
      status: 'PAID',
    },
  };
  const service = {
    processInvoicePaid: jest.fn(),
  } as unknown as jest.Mocked<VisitsService>;
  const channel = { ack: jest.fn(), nack: jest.fn() };
  const message = { content: Buffer.from('{}') };
  const context = {
    getChannelRef: () => channel,
    getMessage: () => message,
  } as unknown as RmqContext;
  const consumer = new VisitEventsController(service);

  beforeEach(() => {
    jest.clearAllMocks();
    service.processInvoicePaid.mockResolvedValue(undefined);
  });

  it('ACKs successful and duplicate invoice.paid events', async () => {
    await consumer.handleInvoicePaid(event, context);
    await consumer.handleInvoicePaid(event, context);

    expect(service.processInvoicePaid).toHaveBeenCalledTimes(2);
    expect(channel.ack).toHaveBeenCalledTimes(2);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('NACKs invalid messages without requeueing', async () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    await consumer.handleInvoicePaid(
      { ...event, payload: { ...event.payload, status: 'PENDING' } },
      context,
    );

    expect(service.processInvoicePaid).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(event.metadata.eventId),
    );
    log.mockRestore();
  });

  it('NACKs transient failures and requeues', async () => {
    const error = new Error('database unavailable');
    service.processInvoicePaid.mockRejectedValue(error);

    await expect(consumer.handleInvoicePaid(event, context)).rejects.toThrow(
      error,
    );

    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
  });
});
