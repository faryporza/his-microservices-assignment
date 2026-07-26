import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { FinanceBcModule } from './finance-bc.module';
import { RmqService } from '@app/common';
import { RABBITMQ_QUEUES } from '@app/contracts';

async function bootstrap() {
  const app = await NestFactory.create(FinanceBcModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const rmqService = app.get(RmqService);
  app.connectMicroservice(
    rmqService.createServiceOptions(RABBITMQ_QUEUES.finance),
  );
  await app.startAllMicroservices();

  await app.listen(process.env.FINANCE_PORT ?? 3002);
}
void bootstrap();
