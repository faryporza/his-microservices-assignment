import { ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import { RABBITMQ_EXCHANGE } from '@app/contracts';
import { RmqService } from './rmq.service';

describe('RmqService', () => {
  let service: RmqService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RmqService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: string) =>
              key === 'RABBITMQ_URL'
                ? 'amqp://user:pass@host:5672'
                : fallback,
          },
        },
      ],
    }).compile();

    service = module.get<RmqService>(RmqService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('falls back to the contract exchange when RABBITMQ_EXCHANGE is unset', () => {
    expect(service.getExchange()).toBe(RABBITMQ_EXCHANGE);
  });

  it('reads the connection URL from configuration', () => {
    expect(service.getUrl()).toBe('amqp://user:pass@host:5672');
  });

  describe('createServiceOptions', () => {
    it('builds durable consumer options for the given queue', () => {
      const options = service.createServiceOptions('opd.events');

      expect(options.transport).toBe(Transport.RMQ);
      expect(options.options).toMatchObject({
        exchange: RABBITMQ_EXCHANGE,
        exchangeType: 'topic',
        queue: 'opd.events',
        wildcards: true,
        persistent: true,
        noAck: false,
        prefetchCount: 1,
      });
      expect(options.options?.urls).toEqual([
        'amqp://user:pass@host:5672',
      ]);
      expect(options.options?.queueOptions).toEqual({ durable: true });
    });
  });

  describe('createClientOptions', () => {
    it('builds durable publisher options', () => {
      const options = service.createClientOptions();

      expect(options.transport).toBe(Transport.RMQ);
      expect(options.options).toMatchObject({
        exchange: RABBITMQ_EXCHANGE,
        exchangeType: 'topic',
        wildcards: true,
        persistent: true,
      });
    });
  });
});
