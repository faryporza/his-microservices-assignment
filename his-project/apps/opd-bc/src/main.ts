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
import { OpdBcModule } from './opd-bc.module';

async function bootstrap() {
  const app = await NestFactory.create(OpdBcModule);
  const config = app.get(ConfigService);
  app.useGlobalPipes(createStrictValidationPipe());
  app.useGlobalInterceptors(new RequestLoggingInterceptor('opd-bc'));
  app.useGlobalFilters(new HttpLoggingExceptionFilter('opd-bc'));

  const rmqService = app.get(RmqService);
  app.connectMicroservice(
    rmqService.createServiceOptions(
      getRequiredString(config, 'OPD_RABBITMQ_QUEUE'),
    ),
  );
  await app.startAllMicroservices();

  await app.listen(getRequiredInteger(config, 'OPD_PORT'));
}
void bootstrap();
