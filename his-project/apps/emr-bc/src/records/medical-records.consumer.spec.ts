import { RmqContext } from '@nestjs/microservices';
import {
  VISIT_CREATED_EVENT_NAME,
  VISIT_CREATED_EVENT_VERSION,
  VisitCreatedEvent,
} from '@app/contracts';
import { MedicalRecordsConsumer } from './medical-records.consumer';
import { MedicalRecord } from './entities/medical-record.entity';
import { MedicalRecordsService } from './medical-records.service';

describe('MedicalRecordsConsumer', () => {
  const event: VisitCreatedEvent = {
    metadata: {
      eventId: 'event-id',
      eventName: VISIT_CREATED_EVENT_NAME,
      version: VISIT_CREATED_EVENT_VERSION,
      occurredAt: '2026-07-28T08:30:00.000Z',
    },
    payload: {
      visitId: '550e8400-e29b-41d4-a716-446655440000',
      patientId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
      timestamp: '2026-07-28T08:30:00.000Z',
    },
  };

  let consumer: MedicalRecordsConsumer;
  let service: jest.Mocked<Pick<MedicalRecordsService, 'createWaitingRecord'>>;
  let channel: { ack: jest.Mock; nack: jest.Mock };
  let message: { content: Buffer };
  let context: RmqContext;

  beforeEach(() => {
    const createdRecord = new MedicalRecord();
    service = {
      createWaitingRecord: jest.fn().mockResolvedValue(createdRecord),
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
    consumer = new MedicalRecordsConsumer(service as MedicalRecordsService);
  });

  it('creates the record and ACKs a valid event', async () => {
    await consumer.handleVisitCreated(event, context);

    expect(service.createWaitingRecord).toHaveBeenCalledWith(
      event.payload.visitId,
      event.payload.patientId,
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('discards an invalid event without requeueing it', async () => {
    await consumer.handleVisitCreated({ payload: {} }, context);

    expect(service.createWaitingRecord).not.toHaveBeenCalled();
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });

  it('requeues a transient failure without ACKing', async () => {
    const error = new Error('database unavailable');
    service.createWaitingRecord.mockRejectedValue(error);

    await expect(consumer.handleVisitCreated(event, context)).rejects.toThrow(
      error,
    );

    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
  });
});
