import { NestFactory, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  AllExceptionsFilter,
  createStrictValidationPipe,
  getRequiredInteger,
  RequestLoggingInterceptor,
  StructuredLogger,
  TransformInterceptor,
} from '@app/common';
import { IamBcModule } from './iam-bc.module';

const logger = new StructuredLogger('iam-bc');

async function bootstrap() {
  const app = await NestFactory.create(IamBcModule, { logger });
  const config = app.get(ConfigService);
  const reflector = app.get(Reflector);
  app.useGlobalPipes(createStrictValidationPipe());
  app.useGlobalInterceptors(
    new RequestLoggingInterceptor(logger),
    new TransformInterceptor(reflector),
  );
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('IAM Microservice (iam-bc)')
    .setDescription(
      'Identity & Access Management API - Authentication, Sessions & User Identity',
    )
    .setVersion('1.0')
    .addTag('Auth')
    .addTag('Users')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = getRequiredInteger(config, 'IAM_PORT');
  await app.listen(port);
}

void bootstrap().catch((error: unknown) => {
  logger.fatal({
    message: 'Service bootstrap failed',
    context: { action: 'BOOTSTRAP_SERVICE' },
    error,
  });
  process.exitCode = 1;
});
