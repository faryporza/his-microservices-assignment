import { RmqContext } from '@nestjs/microservices';
import {
  TREATMENT_COMPLETED_EVENT_NAME,
  TREATMENT_COMPLETED_EVENT_VERSION,
  TreatmentCompletedEvent,
} from '@app/contracts';
import { InvoicesConsumer } from './invoices.consumer';
import { InvoicesService } from './invoices.service';

describe('InvoicesConsumer', () => {
  const event: TreatmentCompletedEvent = {
    metadata: {
      eventId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      eventName: TREATMENT_COMPLETED_EVENT_NAME,
      version: TREATMENT_COMPLETED_EVENT_VERSION,
      occurredAt: '2026-07-29T08:30:00.000Z',
    },
    payload: {
      visitId: '550e8400-e29b-41d4-a716-446655440000',
      recordId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
      treatmentCost: 1500,
    },
  };

  let consumer: InvoicesConsumer;
  let service: jest.Mocked<Pick<InvoicesService, 'createFromTreatment'>>;
  let channel: { ack: jest.Mock; nack: jest.Mock };
  let message: { content: Buffer };
  let context: RmqContext;

  beforeEach(() => {
    service = {
      createFromTreatment: jest.fn().mockResolvedValue(null),
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
    consumer = new InvoicesConsumer(service as InvoicesService);
  });

  it('creates a pending invoice and ACKs after persistence succeeds', async () => {
    await consumer.handleTreatmentCompleted(event, context);

    expect(service.createFromTreatment).toHaveBeenCalledWith(
      event.metadata.eventId,
      {
        visitId: event.payload.visitId,
        recordId: event.payload.recordId,
        totalAmount: 1500,
      },
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('discards an invalid or negative-cost event without requeueing', async () => {
    await consumer.handleTreatmentCompleted(
      {
        ...event,
        payload: { ...event.payload, treatmentCost: -1 },
      },
      context,
    );

    expect(service.createFromTreatment).not.toHaveBeenCalled();
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });

  it('requeues a transient persistence failure without ACKing', async () => {
    const error = new Error('database unavailable');
    service.createFromTreatment.mockRejectedValue(error);

    await expect(
      consumer.handleTreatmentCompleted(event, context),
    ).rejects.toThrow(error);

    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
  });
});
