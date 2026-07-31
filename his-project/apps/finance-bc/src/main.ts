import { NestFactory } from '@nestjs/core';
import { createStrictValidationPipe, RmqService } from '@app/common';
import { FinanceBcModule } from './finance-bc.module';
import { RABBITMQ_QUEUES } from '@app/contracts';

async function bootstrap() {
  const app = await NestFactory.create(FinanceBcModule);
  app.useGlobalPipes(createStrictValidationPipe());

  const rmqService = app.get(RmqService);
  app.connectMicroservice(
    rmqService.createServiceOptions(RABBITMQ_QUEUES.finance),
  );
  await app.startAllMicroservices();

  await app.listen(process.env.FINANCE_PORT ?? 3002);
}
void bootstrap();
