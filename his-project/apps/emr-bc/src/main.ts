import { NestFactory } from '@nestjs/core';
import {
  createStrictValidationPipe,
  HttpLoggingExceptionFilter,
  RequestLoggingInterceptor,
  RmqService,
} from '@app/common';
import { EmrBcModule } from './emr-bc.module';
import { RABBITMQ_QUEUES } from '@app/contracts';

async function bootstrap() {
  const app = await NestFactory.create(EmrBcModule);
  app.useGlobalPipes(createStrictValidationPipe());
  app.useGlobalInterceptors(new RequestLoggingInterceptor('emr-bc'));
  app.useGlobalFilters(new HttpLoggingExceptionFilter('emr-bc'));

  const rmqService = app.get(RmqService);
  app.connectMicroservice(rmqService.createServiceOptions(RABBITMQ_QUEUES.emr));
  await app.startAllMicroservices();

  await app.listen(process.env.EMR_PORT ?? 3001);
}
void bootstrap();
