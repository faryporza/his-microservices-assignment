import { NotFoundException } from '@nestjs/common';
import { RmqContext } from '@nestjs/microservices';
import {
  INVOICE_PAID_EVENT_NAME,
  INVOICE_PAID_EVENT_VERSION,
  InvoicePaidEvent,
} from '@app/contracts';
import { VisitsConsumer } from './visits.consumer';
import { VisitsService } from './visits.service';

describe('VisitsConsumer', () => {
  const event: InvoicePaidEvent = {
    metadata: {
      eventId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      eventName: INVOICE_PAID_EVENT_NAME,
      version: INVOICE_PAID_EVENT_VERSION,
      occurredAt: '2026-07-31T08:30:00.000Z',
    },
    payload: {
      visitId: '550e8400-e29b-41d4-a716-446655440000',
      invoiceId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
      status: 'PAID',
    },
  };

  let consumer: VisitsConsumer;
  let service: jest.Mocked<Pick<VisitsService, 'closeAfterPayment'>>;
  let channel: { ack: jest.Mock; nack: jest.Mock };
  let message: { content: Buffer };
  let context: RmqContext;

  beforeEach(() => {
    service = {
      closeAfterPayment: jest.fn().mockResolvedValue(undefined),
    };
    channel = {
      ack: jest.fn(),
      nack: jest.fn(),
    };
    message = { content: Buffer.from('{}') };
    context = {
      getChannelRef: () => channel,
      getMessage: () => message,
    } as unknown as RmqContext;
    consumer = new VisitsConsumer(service as VisitsService);
  });

  it('closes the visit and ACKs after persistence succeeds', async () => {
    await consumer.handleInvoicePaid(event, context);

    expect(service.closeAfterPayment).toHaveBeenCalledWith(
      event.payload.visitId,
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('discards an invalid event without requeueing', async () => {
    await consumer.handleInvoicePaid(
      {
        ...event,
        payload: { ...event.payload, status: 'PENDING' },
      },
      context,
    );

    expect(service.closeAfterPayment).not.toHaveBeenCalled();
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });

  it('requeues a transient persistence failure without ACKing', async () => {
    const error = new Error('database unavailable');
    service.closeAfterPayment.mockRejectedValue(error);

    await expect(consumer.handleInvoicePaid(event, context)).rejects.toThrow(
      error,
    );

    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
  });

  it('discards an event for a missing visit without requeueing', async () => {
    service.closeAfterPayment.mockRejectedValue(
      new NotFoundException('Visit not found'),
    );

    await consumer.handleInvoicePaid(event, context);

    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });
});
