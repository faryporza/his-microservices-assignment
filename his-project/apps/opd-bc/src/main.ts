import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import {
  createStrictValidationPipe,
  getRequiredInteger,
  getRequiredString,
  HttpLoggingExceptionFilter,
  RequestLoggingInterceptor,
  RabbitMqOptionsService,
  StructuredLogger,
} from '@app/common';
import { OpdBcModule } from './opd-bc.module';

const logger = new StructuredLogger('opd-bc');

async function bootstrap() {
  const app = await NestFactory.create(OpdBcModule, { logger });
  const config = app.get(ConfigService);
  app.useGlobalPipes(createStrictValidationPipe());
  app.useGlobalInterceptors(new RequestLoggingInterceptor(logger));
  app.useGlobalFilters(new HttpLoggingExceptionFilter(logger));

  const rmqService = app.get(RabbitMqOptionsService);
  app.connectMicroservice(
    rmqService.createServiceOptions(
      getRequiredString(config, 'OPD_RABBITMQ_QUEUE'),
    ),
  );
  await app.startAllMicroservices();

  await app.listen(getRequiredInteger(config, 'OPD_PORT'));
}
void bootstrap().catch((error: unknown) => {
  logger.fatal({
    message: 'Service bootstrap failed',
    context: { action: 'BOOTSTRAP_SERVICE' },
    error,
  });
  process.exitCode = 1;
});
