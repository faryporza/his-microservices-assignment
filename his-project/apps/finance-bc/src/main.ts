import { NestFactory, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  AllExceptionsFilter,
  createStrictValidationPipe,
  getRequiredInteger,
  getRequiredString,
  RequestLoggingInterceptor,
  RabbitMqOptionsService,
  StructuredLogger,
  TransformInterceptor,
} from '@app/common';
import { FinanceBcModule } from './finance-bc.module';

const logger = new StructuredLogger('finance-bc');

async function bootstrap() {
  const app = await NestFactory.create(FinanceBcModule, { logger });
  const config = app.get(ConfigService);
  const reflector = app.get(Reflector);
  app.useGlobalPipes(createStrictValidationPipe());
  app.useGlobalInterceptors(
    new RequestLoggingInterceptor(logger),
    new TransformInterceptor(reflector),
  );
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Finance Microservice (finance-bc)')
    .setDescription(
      'Billing & Finance API - Invoice Management & Payment Processing',
    )
    .setVersion('1.0')
    .addTag('Invoices')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const rmqService = app.get(RabbitMqOptionsService);
  app.connectMicroservice(
    rmqService.createServiceOptions(
      getRequiredString(config, 'FINANCE_RABBITMQ_QUEUE'),
    ),
  );
  await app.startAllMicroservices();

  await app.listen(getRequiredInteger(config, 'FINANCE_PORT'));
}
void bootstrap().catch((error: unknown) => {
  logger.fatal({
    message: 'Service bootstrap failed',
    context: { action: 'BOOTSTRAP_SERVICE' },
    error,
  });
  process.exitCode = 1;
});
