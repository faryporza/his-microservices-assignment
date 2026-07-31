import { RmqContext } from '@nestjs/microservices';
import {
  VISIT_CREATED_EVENT_NAME,
  VISIT_CREATED_EVENT_VERSION,
  VisitCreatedEvent,
} from '@app/contracts';
import { MedicalRecordsConsumer } from './medical-records.consumer';
import { MedicalRecordsService } from './medical-records.service';

describe('MedicalRecordsConsumer', () => {
  const event: VisitCreatedEvent = {
    metadata: {
      eventId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      eventName: VISIT_CREATED_EVENT_NAME,
      version: VISIT_CREATED_EVENT_VERSION,
      occurredAt: '2026-08-01T00:00:00.000Z',
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
  const consumer = new MedicalRecordsConsumer(service);

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
    await consumer.handleVisitCreated({ payload: {} }, context);

    expect(service.processVisitCreated).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
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
