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
import { FinanceBcModule } from './finance-bc.module';

async function bootstrap() {
  const app = await NestFactory.create(FinanceBcModule);
  const config = app.get(ConfigService);
  app.useGlobalPipes(createStrictValidationPipe());
  app.useGlobalInterceptors(new RequestLoggingInterceptor('finance-bc'));
  app.useGlobalFilters(new HttpLoggingExceptionFilter('finance-bc'));

  const rmqService = app.get(RmqService);
  app.connectMicroservice(
    rmqService.createServiceOptions(
      getRequiredString(config, 'FINANCE_RABBITMQ_QUEUE'),
    ),
  );
  await app.startAllMicroservices();

  await app.listen(getRequiredInteger(config, 'FINANCE_PORT'));
}
void bootstrap();
