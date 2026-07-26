import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { EmrBcModule } from './emr-bc.module';
import { RmqService } from '@app/common';
import { RABBITMQ_QUEUES } from '@app/contracts';

async function bootstrap() {
  const app = await NestFactory.create(EmrBcModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const rmqService = app.get(RmqService);
  app.connectMicroservice(
    rmqService.createServiceOptions(RABBITMQ_QUEUES.emr),
  );
  await app.startAllMicroservices();

  await app.listen(process.env.EMR_PORT ?? 3001);
}
void bootstrap();
