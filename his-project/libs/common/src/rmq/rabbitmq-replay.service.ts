import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, Channel, ChannelModel } from 'amqplib';
import { StructuredLogger } from '../logging/structured.logger';

export interface ReplayDlqResult {
  replayedCount: number;
  errorsCount: number;
}

@Injectable()
export class RabbitMqReplayService {
  private readonly logger = new StructuredLogger('rmq-replay-service');

  constructor(private readonly config: ConfigService) {}

  async replayDlqMessages(
    dlqQueueName: string,
    targetExchangeName?: string,
    maxMessages = 100,
  ): Promise<ReplayDlqResult> {
    const rmqUrl = this.config.getOrThrow<string>('RABBITMQ_URL');
    const exchange =
      targetExchangeName ??
      this.config.get<string>('RABBITMQ_EXCHANGE', 'his.events');

    let replayedCount = 0;
    let errorsCount = 0;

    let connection: ChannelModel | null = null;
    let channel: Channel | null = null;

    try {
      connection = await connect(rmqUrl);
      channel = await connection.createChannel();

      for (let i = 0; i < maxMessages; i++) {
        const msg = await channel.get(dlqQueueName, { noAck: false });
        if (!msg) {
          break;
        }

        try {
          const rawHeaders = msg.properties.headers;
          const firstDeathKeys: unknown =
            rawHeaders?.['x-first-death-routing-keys'];
          const deathKey =
            Array.isArray(firstDeathKeys) &&
            typeof firstDeathKeys[0] === 'string'
              ? firstDeathKeys[0]
              : undefined;

          const routingKey =
            deathKey || msg.fields.routingKey || 'replayed.event';

          channel.publish(exchange, routingKey, msg.content, {
            ...msg.properties,
            headers: {
              ...msg.properties.headers,
              'x-replayed-at': new Date().toISOString(),
            },
          });

          channel.ack(msg);
          replayedCount++;
        } catch (err: unknown) {
          errorsCount++;
          channel.nack(msg, false, true);
          this.logger.error({
            message: 'Failed to replay message from DLQ',
            context: { queue: dlqQueueName },
            error: err,
          });
        }
      }
    } catch (error: unknown) {
      this.logger.error({
        message: 'DLQ replay connection error',
        context: { queue: dlqQueueName },
        error,
      });
    } finally {
      if (channel) {
        await channel.close().catch(() => {});
      }
      if (connection) {
        await connection.close().catch(() => {});
      }
    }

    return { replayedCount, errorsCount };
  }
}
