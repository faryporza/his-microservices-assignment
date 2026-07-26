import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { OpdBcModule } from './opd-bc.module';
import { RmqService } from '@app/common';
import { RABBITMQ_QUEUES } from '@app/contracts';

async function bootstrap() {
  const app = await NestFactory.create(OpdBcModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const rmqService = app.get(RmqService);
  app.connectMicroservice(
    rmqService.createServiceOptions(RABBITMQ_QUEUES.opd),
  );
  await app.startAllMicroservices();

  await app.listen(process.env.OPD_PORT ?? 3000);
}
void bootstrap();
