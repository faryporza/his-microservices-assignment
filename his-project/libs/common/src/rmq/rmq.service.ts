import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RmqOptions, Transport } from '@nestjs/microservices';

/**
 * Builds {@link RmqOptions} for the NestJS RabbitMQ microservice transport.
 *
 * Each bounded context calls `createServiceOptions(queue)` in its `main.ts`
 * to start a microservice that consumes its queue, and `createClientOptions()`
 * when it needs a `ClientProxy` to publish events to the `his.events` exchange.
 *
 * The exchange and queues are durable and messages are persistent, so events
 * survive a broker restart. `noAck` is false and `prefetchCount` is 1 so a
 * consumer only ACKs after its database transaction succeeds and is never
 * handed more than one in-flight message at a time.
 */
@Injectable()
export class RmqService {
  constructor(private readonly config: ConfigService) {}

  /** The `amqp://` connection URL read from configuration. */
  getUrl(): string {
    return this.config.getOrThrow<string>('RABBITMQ_URL');
  }

  /** The durable topic exchange every service publishes to. */
  getExchange(): string {
    return this.config.getOrThrow<string>('RABBITMQ_EXCHANGE');
  }

  /**
   * Options for a *consuming* microservice bound to `queue`. Use with
   * `NestFactory.createMicroservice(app, rmqService.createServiceOptions(q))`.
   *
   * `wildcards: true` lets `@EventPattern('visit.created')` match the routing
   * keys published to the topic exchange.
   */
  createServiceOptions(queue: string): RmqOptions {
    return {
      transport: Transport.RMQ,
      options: {
        urls: [this.getUrl()],
        // The transport asserts this exchange as durable by default.
        exchange: this.getExchange(),
        exchangeType: 'topic',
        queue,
        queueOptions: { durable: true },
        wildcards: true,
        persistent: true,
        noAck: false,
        prefetchCount: 1,
        maxConnectionAttempts: -1,
      },
    };
  }

  /**
   * Options for a *publishing* `ClientProxy`. Use with
   * `ClientsModule.registerAsync` or `ClientProxyFactory.create`.
   */
  createClientOptions(queue?: string): RmqOptions {
    return {
      transport: Transport.RMQ,
      options: {
        urls: [this.getUrl()],
        // The transport asserts this exchange as durable by default.
        exchange: this.getExchange(),
        exchangeType: 'topic',
        ...(queue ? { queue } : {}),
        queueOptions: { durable: true },
        wildcards: true,
        persistent: true,
      },
    };
  }
}
