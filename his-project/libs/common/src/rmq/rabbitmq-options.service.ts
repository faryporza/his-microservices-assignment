import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RmqOptions, Transport } from '@nestjs/microservices';
import { connect } from 'amqplib';
import {
  rabbitMqBindings,
  rabbitMqDlxExchange,
  rabbitMqDlqQueues,
} from '@app/contracts';

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
export class RabbitMqOptionsService {
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
  createServiceOptions(queue: string, dlqRoutingKey?: string): RmqOptions {
    const dlx = this.config.get<string>(
      'RABBITMQ_DLX_EXCHANGE',
      'his.events.dlx',
    );
    const queueOptions: Record<string, unknown> = {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': dlx,
        'x-dead-letter-routing-key': dlqRoutingKey ?? `${queue}.dlq`,
      },
    };

    return {
      transport: Transport.RMQ,
      options: {
        urls: [this.getUrl()],
        // The transport asserts this exchange as durable by default.
        exchange: this.getExchange(),
        exchangeType: 'topic',
        queue,
        queueOptions,
        wildcards: true,
        persistent: true,
        noAck: false,
        prefetchCount: 1,
        maxConnectionAttempts: -1,
      },
    };
  }

  /**
   * Declares the complete broker topology. Nest's RMQ transport declares the
   * consuming queue, but it does not create the dead-letter exchange, DLQ, or
   * bindings required when a message is rejected.
   */
  async ensureTopology(queue: string): Promise<void> {
    const connection = await connect(this.getUrl());
    const channel = await connection.createChannel();
    const exchange = this.getExchange();
    const dlx = this.config.get<string>(
      'RABBITMQ_DLX_EXCHANGE',
      rabbitMqDlxExchange,
    );
    const dlq = this.getDlqName(queue);

    try {
      await channel.assertExchange(exchange, 'topic', { durable: true });
      await channel.assertExchange(dlx, 'direct', { durable: true });
      await channel.assertQueue(queue, {
        durable: true,
        autoDelete: false,
        arguments: {
          'x-dead-letter-exchange': dlx,
          'x-dead-letter-routing-key': `${queue}.dlq`,
        },
      });
      await channel.assertQueue(dlq, { durable: true, autoDelete: false });
      await channel.bindQueue(dlq, dlx, `${queue}.dlq`);

      for (const [routingKey, boundQueue] of Object.entries(rabbitMqBindings)) {
        if (boundQueue === queue) {
          await channel.bindQueue(queue, exchange, routingKey);
        }
      }
    } finally {
      await channel.close();
      await connection.close();
    }
  }

  private getDlqName(queue: string): string {
    const knownQueue = Object.entries(rabbitMqDlqQueues).find(
      ([, value]) => value.replace('.dlq', '') === queue,
    );
    return knownQueue?.[1] ?? `${queue}.dlq`;
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
