import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RABBITMQ_EXCHANGE } from '@app/contracts';

export const RMQ_CLIENT = 'RMQ_CLIENT';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: RMQ_CLIENT,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              configService.get<string>(
                'RABBITMQ_URL',
                'amqp://guest:guest@localhost:5672',
              ),
            ],
            exchange: configService.get<string>(
              'RABBITMQ_EXCHANGE',
              RABBITMQ_EXCHANGE,
            ),
            exchangeType: 'topic',
            wildcards: true,
            persistent: true,
          },
        }),
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class OpdRabbitMqModule {}
