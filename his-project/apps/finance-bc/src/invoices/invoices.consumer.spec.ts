import { RmqContext } from '@nestjs/microservices';
import { StructuredLogger } from '@app/common';
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
      occurredAt: '2026-08-01T00:00:00.000Z',
      correlationId: 'correlation-id',
      traceId: 'trace-id',
    },
    payload: {
      visitId: '550e8400-e29b-41d4-a716-446655440000',
      recordId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
      treatmentCost: '1500.00',
    },
  };
  const service = {
    processTreatmentCompleted: jest.fn(),
  } as unknown as jest.Mocked<InvoicesService>;
  const channel = { ack: jest.fn(), nack: jest.fn() };
  const message = { content: Buffer.from('{}') };
  const context = {
    getChannelRef: () => channel,
    getMessage: () => message,
  } as unknown as RmqContext;
  const consumer = new InvoicesConsumer(service);

  beforeEach(() => {
    jest.clearAllMocks();
    service.processTreatmentCompleted.mockResolvedValue(undefined);
  });

  it('ACKs only after invoice and event marker are committed', async () => {
    await consumer.handleTreatmentCompleted(event, context);

    expect(service.processTreatmentCompleted).toHaveBeenCalledWith(event);
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(
      service.processTreatmentCompleted.mock.invocationCallOrder[0],
    ).toBeLessThan(channel.ack.mock.invocationCallOrder[0]);
  });

  it('NACKs invalid messages without requeueing', async () => {
    const log = jest
      .spyOn(StructuredLogger.prototype, 'warn')
      .mockImplementation();
    await consumer.handleTreatmentCompleted(
      { ...event, payload: { ...event.payload, treatmentCost: '-1' } },
      context,
    );

    expect(service.processTreatmentCompleted).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          event_id: event.metadata.eventId,
          event_status: 'DISCARDED',
        }),
      }),
    );
    log.mockRestore();
  });

  it('NACKs transient failures and requeues', async () => {
    const error = new Error('database unavailable');
    service.processTreatmentCompleted.mockRejectedValue(error);

    await expect(
      consumer.handleTreatmentCompleted(event, context),
    ).rejects.toThrow(error);

    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
  });
});
