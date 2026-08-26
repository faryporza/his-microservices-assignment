import { ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import { connect } from 'amqplib';
import type { Channel, ChannelModel } from 'amqplib';
import { RabbitMqOptionsService } from './rabbitmq-options.service';

jest.mock('amqplib', () => ({ connect: jest.fn() }));

describe('RabbitMqOptionsService', () => {
  let service: RabbitMqOptionsService;
  const connectMock = connect as jest.MockedFunction<typeof connect>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RabbitMqOptionsService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              const values: Record<string, string> = {
                RABBITMQ_URL: 'amqp://user:pass@host:5672',
                RABBITMQ_EXCHANGE: 'his.events.test',
              };
              return values[key];
            },
            get: (key: string, defaultValue?: string) => {
              const values: Record<string, string> = {
                RABBITMQ_URL: 'amqp://user:pass@host:5672',
                RABBITMQ_EXCHANGE: 'his.events.test',
                RABBITMQ_DLX_EXCHANGE: 'his.events.dlx',
              };
              return values[key] ?? defaultValue;
            },
          },
        },
      ],
    }).compile();

    service = module.get<RabbitMqOptionsService>(RabbitMqOptionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('reads the exchange name from configuration', () => {
    expect(service.getExchange()).toBe('his.events.test');
  });

  it('reads the connection URL from configuration', () => {
    expect(service.getUrl()).toBe('amqp://user:pass@host:5672');
  });

  describe('createServiceOptions', () => {
    it('builds durable consumer options for the given queue', () => {
      const options = service.createServiceOptions('opd.events');

      expect(options.transport).toBe(Transport.RMQ);
      expect(options.options).toMatchObject({
        exchange: 'his.events.test',
        exchangeType: 'topic',
        queue: 'opd.events',
        wildcards: true,
        persistent: true,
        noAck: false,
        prefetchCount: 1,
      });
      expect(options.options?.urls).toEqual(['amqp://user:pass@host:5672']);
      expect(options.options?.queueOptions).toMatchObject({
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'his.events.dlx',
          'x-dead-letter-routing-key': 'opd.events.dlq',
        },
      });
    });
  });

  describe('createClientOptions', () => {
    it('builds durable publisher options', () => {
      const options = service.createClientOptions();

      expect(options.transport).toBe(Transport.RMQ);
      expect(options.options).toMatchObject({
        exchange: 'his.events.test',
        exchangeType: 'topic',
        wildcards: true,
        persistent: true,
      });
    });
  });

  describe('ensureTopology', () => {
    it('declares the main queue, DLQ, exchanges, and bindings', async () => {
      const channel = {
        assertExchange: jest.fn().mockResolvedValue(undefined),
        assertQueue: jest.fn().mockResolvedValue(undefined),
        bindQueue: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
      } as unknown as jest.Mocked<Channel>;
      const connection = {
        createChannel: jest.fn().mockResolvedValue(channel),
        close: jest.fn().mockResolvedValue(undefined),
      } as unknown as jest.Mocked<ChannelModel>;
      connectMock.mockResolvedValueOnce(connection);

      await service.ensureTopology('opd.events');

      expect(channel.assertExchange).toHaveBeenCalledWith(
        'his.events.test',
        'topic',
        { durable: true },
      );
      expect(channel.assertExchange).toHaveBeenCalledWith(
        'his.events.dlx',
        'direct',
        { durable: true },
      );
      expect(channel.assertQueue).toHaveBeenCalledWith(
        'opd.events.dlq',
        expect.objectContaining({ durable: true, autoDelete: false }),
      );
      expect(channel.bindQueue).toHaveBeenCalledWith(
        'opd.events.dlq',
        'his.events.dlx',
        'opd.events.dlq',
      );
      expect(channel.bindQueue).toHaveBeenCalledWith(
        'opd.events',
        'his.events.test',
        'invoice.paid',
      );
      expect(channel.close).toHaveBeenCalled();
      expect(connection.close).toHaveBeenCalled();
    });
  });
});
