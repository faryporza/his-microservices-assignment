import { NestFactory, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  AllExceptionsFilter,
  AccessAuditInterceptor,
  AuditService,
  createStrictValidationPipe,
  getRequiredInteger,
  getRequiredString,
  RequestLoggingInterceptor,
  RabbitMqOptionsService,
  StructuredLogger,
  TransformInterceptor,
} from '@app/common';
import { OpdBcModule } from './opd-bc.module';

const logger = new StructuredLogger('opd-bc');

async function bootstrap() {
  const app = await NestFactory.create(OpdBcModule, { logger });
  const config = app.get(ConfigService);
  const reflector = app.get(Reflector);
  const apiPrefix = (config.get<string>('API_PREFIX', 'api/v1') ?? '').replace(
    /^\/+|\/+$/g,
    '',
  );
  if (apiPrefix) {
    app.setGlobalPrefix(apiPrefix, {
      exclude: ['/', 'docs', 'docs-json', 'health'],
    });
  }
  app.useGlobalPipes(createStrictValidationPipe());
  app.useGlobalInterceptors(
    new RequestLoggingInterceptor(logger),
    new TransformInterceptor(reflector),
    new AccessAuditInterceptor(reflector, app.get(AuditService)),
  );
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('OPD Microservice (opd-bc)')
    .setDescription(
      'Outpatient Department API - Patient Registration & Visit Management',
    )
    .setVersion('1.0')
    .addTag('Patients')
    .addTag('Visits')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const rmqService = app.get(RabbitMqOptionsService);
  const queue = getRequiredString(config, 'OPD_RABBITMQ_QUEUE');
  await rmqService.ensureTopology(queue);
  app.connectMicroservice(rmqService.createServiceOptions(queue));
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
