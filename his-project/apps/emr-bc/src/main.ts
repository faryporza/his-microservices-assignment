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
import { EmrBcModule } from './emr-bc.module';

const logger = new StructuredLogger('emr-bc');

async function bootstrap() {
  const app = await NestFactory.create(EmrBcModule, { logger });
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
    .setTitle('EMR Microservice (emr-bc)')
    .setDescription(
      'Electronic Medical Records API - Medical Records & Treatment Management',
    )
    .setVersion('1.0')
    .addTag('Medical Records')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const rmqService = app.get(RabbitMqOptionsService);
  const queue = getRequiredString(config, 'EMR_RABBITMQ_QUEUE');
  await rmqService.ensureTopology(queue);
  app.connectMicroservice(rmqService.createServiceOptions(queue));
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
