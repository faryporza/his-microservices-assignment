import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RmqOptions, Transport } from '@nestjs/microservices';
import { RABBITMQ_EXCHANGE, RABBITMQ_QUEUES } from '@app/contracts';
import { FinanceBcModule } from './finance-bc.module';

async function bootstrap() {
  const app = await NestFactory.create(FinanceBcModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const configService = app.get(ConfigService);
  app.connectMicroservice<RmqOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [
        configService.get<string>(
          'RABBITMQ_URL',
          'amqp://guest:guest@localhost:5672',
        ),
      ],
      queue: RABBITMQ_QUEUES.finance,
      queueOptions: { durable: true },
      exchange: configService.get<string>(
        'RABBITMQ_EXCHANGE',
        RABBITMQ_EXCHANGE,
      ),
      exchangeType: 'topic',
      wildcards: true,
      persistent: true,
      noAck: false,
      prefetchCount: 1,
    },
  });
  await app.startAllMicroservices();

  await app.listen(process.env.FINANCE_PORT ?? 3002);
}
void bootstrap();
