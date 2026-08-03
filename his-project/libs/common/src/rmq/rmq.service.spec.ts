import { ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
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
            getOrThrow: (key: string) => {
              const values: Record<string, string> = {
                RABBITMQ_URL: 'amqp://user:pass@host:5672',
                RABBITMQ_EXCHANGE: 'his.events.test',
              };
              return values[key];
            },
          },
        },
      ],
    }).compile();

    service = module.get<RmqService>(RmqService);
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
        exchange: 'his.events.test',
        exchangeType: 'topic',
        wildcards: true,
        persistent: true,
      });
    });
  });
});
