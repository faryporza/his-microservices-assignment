import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonService } from './common.service';
import { RmqService } from './rmq/rmq.service';
import { IdempotencyService } from './idempotency/idempotency.service';
import { ProcessedEvent } from './idempotency/processed-event.entity';

export const RMQ_CLIENT = 'RMQ_CLIENT';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([ProcessedEvent]),
    ClientsModule.registerAsync([
      {
        name: RMQ_CLIENT,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          const rmqService = new RmqService(configService);
          return rmqService.createClientOptions();
        },
      },
    ]),
  ],
  providers: [CommonService, RmqService, IdempotencyService],
  exports: [
    CommonService,
    RmqService,
    IdempotencyService,
    ClientsModule,
    TypeOrmModule,
  ],
})
export class CommonModule {}
