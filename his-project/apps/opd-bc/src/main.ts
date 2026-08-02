import { NestFactory } from '@nestjs/core';
import {
  createStrictValidationPipe,
  HttpLoggingExceptionFilter,
  RequestLoggingInterceptor,
  RmqService,
} from '@app/common';
import { OpdBcModule } from './opd-bc.module';
import { RABBITMQ_QUEUES } from '@app/contracts';

async function bootstrap() {
  const app = await NestFactory.create(OpdBcModule);
  app.useGlobalPipes(createStrictValidationPipe());
  app.useGlobalInterceptors(new RequestLoggingInterceptor('opd-bc'));
  app.useGlobalFilters(new HttpLoggingExceptionFilter('opd-bc'));

  const rmqService = app.get(RmqService);
  app.connectMicroservice(rmqService.createServiceOptions(RABBITMQ_QUEUES.opd));
  await app.startAllMicroservices();

  await app.listen(process.env.OPD_PORT ?? 3000);
}
void bootstrap();
