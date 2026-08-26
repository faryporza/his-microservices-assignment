import { ConfigService } from '@nestjs/config';
import { connect } from 'amqplib';
import type { Channel, ChannelModel, GetMessage } from 'amqplib';
import { RabbitMqOptionsService } from '@app/common';
import {
  rabbitMqDlxExchange,
  rabbitMqDlqQueues,
  rabbitMqQueues,
} from '@app/contracts';

const liveDescribe =
  process.env.RUN_LIVE_INTEGRATION === 'true' ? describe : describe.skip;

async function getMessageWithRetry(
  channel: Channel,
  queue: string,
  attempts = 30,
): Promise<GetMessage | false> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const message = await channel.get(queue, { noAck: false });
    if (message) return message;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

liveDescribe('RabbitMQ DLQ Topology & Replay CLI (R9)', () => {
  let connection: ChannelModel;
  let channel: Channel;
  let service: RabbitMqOptionsService;

  beforeAll(async () => {
    const config = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'RABBITMQ_URL') {
          return (
            process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672'
          );
        }
        return process.env.RABBITMQ_EXCHANGE ?? 'his.events';
      }),
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'RABBITMQ_DLX_EXCHANGE') {
          return process.env.RABBITMQ_DLX_EXCHANGE ?? defaultValue;
        }
        return process.env.RABBITMQ_EXCHANGE ?? defaultValue;
      }),
    } as unknown as ConfigService;
    service = new RabbitMqOptionsService(config);
    connection = await connect(
      process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
    );
    channel = await connection.createChannel();
  });

  afterAll(async () => {
    await channel?.close().catch(() => undefined);
    await connection?.close().catch(() => undefined);
  });

  it('declares every main queue, DLQ, exchange, and binding on a real broker', async () => {
    for (const queue of Object.values(rabbitMqQueues)) {
      await service.ensureTopology(queue);
      await channel.checkQueue(queue);
      await channel.checkQueue(
        Object.values(rabbitMqDlqQueues).find((value) =>
          value.startsWith(queue),
        ) ?? `${queue}.dlq`,
      );
    }

    await channel.checkExchange(process.env.RABBITMQ_EXCHANGE ?? 'his.events');
    await channel.checkExchange(
      process.env.RABBITMQ_DLX_EXCHANGE ?? rabbitMqDlxExchange,
    );
  });

  it('routes a rejected message to a DLQ on a real broker', async () => {
    const suffix = `probe-${Date.now()}`;
    const sourceQueue = `his.dlq.${suffix}`;
    const deadLetterQueue = `${sourceQueue}.dlq`;
    const marker = `dlq-marker-${suffix}`;
    const dlx = process.env.RABBITMQ_DLX_EXCHANGE ?? rabbitMqDlxExchange;

    await channel.assertQueue(sourceQueue, {
      durable: false,
      autoDelete: true,
      arguments: {
        'x-dead-letter-exchange': dlx,
        'x-dead-letter-routing-key': deadLetterQueue,
      },
    });
    await channel.assertQueue(deadLetterQueue, {
      durable: false,
      autoDelete: true,
    });
    await channel.bindQueue(deadLetterQueue, dlx, deadLetterQueue);
    channel.sendToQueue(sourceQueue, Buffer.from(marker), {
      persistent: false,
    });

    const received = await getMessageWithRetry(channel, sourceQueue);
    expect(received).toBeTruthy();
    if (received) channel.nack(received, false, false);

    const deadLettered = await getMessageWithRetry(channel, deadLetterQueue);
    expect(deadLettered).toBeTruthy();
    expect(deadLettered && deadLettered.content.toString()).toBe(marker);
    if (deadLettered) channel.ack(deadLettered);

    await channel.deleteQueue(sourceQueue);
    await channel.deleteQueue(deadLetterQueue);
  });
});
