import { ConfigService } from '@nestjs/config';
import { connect } from 'amqplib';
import type { Channel, ChannelModel, GetMessage } from 'amqplib';
import { RabbitMqReplayService } from './rabbitmq-replay.service';

jest.mock('amqplib', () => ({ connect: jest.fn() }));

describe('RabbitMqReplayService', () => {
  const connectMock = connect as jest.MockedFunction<typeof connect>;
  const config = {
    getOrThrow: jest.fn().mockReturnValue('amqp://guest:guest@localhost:5672'),
    get: jest.fn().mockReturnValue('his.events'),
  } as unknown as ConfigService;
  let channel: jest.Mocked<Channel>;
  let connection: jest.Mocked<ChannelModel>;
  let service: RabbitMqReplayService;

  beforeEach(() => {
    jest.clearAllMocks();
    channel = {
      get: jest.fn().mockResolvedValue(false),
      publish: jest.fn().mockReturnValue(true),
      ack: jest.fn(),
      nack: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Channel>;
    connection = {
      createChannel: jest.fn().mockResolvedValue(channel),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ChannelModel>;
    connectMock.mockResolvedValue(connection);
    service = new RabbitMqReplayService(config);
  });

  it('replays messages and acknowledges them', async () => {
    const message = {
      content: Buffer.from('event-body'),
      fields: { routingKey: 'visit.created' },
      properties: { headers: {} },
    } as GetMessage;
    channel.get.mockResolvedValueOnce(message).mockResolvedValueOnce(false);

    await expect(service.replayDlqMessages('opd.events.dlq')).resolves.toEqual({
      replayedCount: 1,
      errorsCount: 0,
    });
    expect(channel.publish).toHaveBeenCalledWith(
      'his.events',
      'visit.created',
      message.content,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('requeues a message when replay publishing fails', async () => {
    const message = {
      content: Buffer.from('event-body'),
      fields: { routingKey: 'visit.created' },
      properties: { headers: {} },
    } as GetMessage;
    channel.get.mockResolvedValueOnce(message).mockResolvedValueOnce(false);
    channel.publish.mockImplementation(() => {
      throw new Error('publish failed');
    });

    await expect(service.replayDlqMessages('opd.events.dlq')).resolves.toEqual({
      replayedCount: 0,
      errorsCount: 1,
    });
    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
  });

  it('propagates broker connection failures to the operator', async () => {
    const error = new Error('connection refused');
    connectMock.mockRejectedValueOnce(error);

    await expect(service.replayDlqMessages('opd.events.dlq')).rejects.toBe(
      error,
    );
  });
});
