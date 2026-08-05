import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RabbitMqOptionsService } from './rmq/rabbitmq-options.service';
import { IdempotencyService } from './idempotency/idempotency.service';
import { ProcessedEvent } from './idempotency/processed-event.entity';

export const rmqClient = 'rmqClient';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([ProcessedEvent]),
    ClientsModule.registerAsync([
      {
        name: rmqClient,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          const rmqService = new RabbitMqOptionsService(configService);
          return rmqService.createClientOptions();
        },
      },
    ]),
  ],
  providers: [RabbitMqOptionsService, IdempotencyService],
  exports: [RabbitMqOptionsService, IdempotencyService, ClientsModule, TypeOrmModule],
})
export class CommonModule {}
