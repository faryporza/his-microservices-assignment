import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import {
  createStrictValidationPipe,
  getRequiredInteger,
  getRequiredString,
  HttpLoggingExceptionFilter,
  RequestLoggingInterceptor,
  RmqService,
  StructuredLogger,
} from '@app/common';
import { EmrBcModule } from './emr-bc.module';

const logger = new StructuredLogger('emr-bc');

async function bootstrap() {
  const app = await NestFactory.create(EmrBcModule, { logger });
  const config = app.get(ConfigService);
  app.useGlobalPipes(createStrictValidationPipe());
  app.useGlobalInterceptors(new RequestLoggingInterceptor(logger));
  app.useGlobalFilters(new HttpLoggingExceptionFilter(logger));

  const rmqService = app.get(RmqService);
  app.connectMicroservice(
    rmqService.createServiceOptions(
      getRequiredString(config, 'EMR_RABBITMQ_QUEUE'),
    ),
  );
  await app.startAllMicroservices();

  await app.listen(getRequiredInteger(config, 'EMR_PORT'));
}
void bootstrap().catch((error: unknown) => {
  logger.fatal({
    message: 'Service bootstrap failed',
    context: { action: 'BOOTSTRAP_SERVICE' },
    error,
  });
  process.exitCode = 1;
});
