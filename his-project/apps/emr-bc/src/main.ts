import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import {
  createStrictValidationPipe,
  getRequiredInteger,
  getRequiredString,
  HttpLoggingExceptionFilter,
  RequestLoggingInterceptor,
  RmqService,
} from '@app/common';
import { EmrBcModule } from './emr-bc.module';

async function bootstrap() {
  const app = await NestFactory.create(EmrBcModule);
  const config = app.get(ConfigService);
  app.useGlobalPipes(createStrictValidationPipe());
  app.useGlobalInterceptors(new RequestLoggingInterceptor('emr-bc'));
  app.useGlobalFilters(new HttpLoggingExceptionFilter('emr-bc'));

  const rmqService = app.get(RmqService);
  app.connectMicroservice(
    rmqService.createServiceOptions(
      getRequiredString(config, 'EMR_RABBITMQ_QUEUE'),
    ),
  );
  await app.startAllMicroservices();

  await app.listen(getRequiredInteger(config, 'EMR_PORT'));
}
void bootstrap();
