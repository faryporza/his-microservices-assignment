import { RmqContext } from '@nestjs/microservices';
import { StructuredLogger } from '@app/common';
import {
  visitCreatedEventName,
  visitCreatedEventVersion,
  VisitCreatedEvent,
} from '@app/contracts';
import { MedicalRecordEventsController } from './medical-record-events.controller';
import { MedicalRecordsService } from './medical-records.service';

describe('MedicalRecordEventsController', () => {
  const event: VisitCreatedEvent = {
    metadata: {
      eventId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      eventName: visitCreatedEventName,
      version: visitCreatedEventVersion,
      occurredAt: '2026-08-01T00:00:00.000Z',
      correlationId: 'correlation-id',
      traceId: 'trace-id',
    },
    payload: {
      visitId: '550e8400-e29b-41d4-a716-446655440000',
      patientId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
      timestamp: '2026-08-01T00:00:00.000Z',
    },
  };
  const service = {
    processVisitCreated: jest.fn(),
  } as unknown as jest.Mocked<MedicalRecordsService>;
  const channel = { ack: jest.fn(), nack: jest.fn() };
  const message = { content: Buffer.from('{}') };
  const context = {
    getChannelRef: () => channel,
    getMessage: () => message,
  } as unknown as RmqContext;
  const consumer = new MedicalRecordEventsController(service);

  beforeEach(() => {
    jest.clearAllMocks();
    service.processVisitCreated.mockResolvedValue(undefined);
  });

  it('ACKs only after business logic succeeds', async () => {
    await consumer.handleVisitCreated(event, context);

    expect(service.processVisitCreated).toHaveBeenCalledWith(event);
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(
      service.processVisitCreated.mock.invocationCallOrder[0],
    ).toBeLessThan(channel.ack.mock.invocationCallOrder[0]);
  });

  it('NACKs invalid messages without requeueing', async () => {
    const log = jest
      .spyOn(StructuredLogger.prototype, 'warn')
      .mockImplementation();
    await consumer.handleVisitCreated(
      { ...event, payload: { ...event.payload, visitId: 'invalid' } },
      context,
    );

    expect(service.processVisitCreated).not.toHaveBeenCalled();
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
    service.processVisitCreated.mockRejectedValue(error);

    await expect(consumer.handleVisitCreated(event, context)).rejects.toThrow(
      error,
    );

    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
  });
});
