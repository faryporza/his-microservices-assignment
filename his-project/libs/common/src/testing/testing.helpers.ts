import { INestApplication, Provider, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import { createStrictValidationPipe } from '../validation/strict-validation.pipe';
import { TransformInterceptor } from '../response/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../filters/all-exceptions.filter';
import { StructuredLogger } from '../logging/structured.logger';

export function createTestingModule(
  controllers: Type<object>[] = [],
  providers: Provider[] = [],
): TestingModuleBuilder {
  return Test.createTestingModule({
    controllers,
    providers,
  });
}

export function createTestApp(
  module: TestingModule,
  serviceName = 'test-app',
): INestApplication {
  const app = module.createNestApplication();
  const reflector = app.get(Reflector);
  const logger = new StructuredLogger(serviceName);

  app.useGlobalPipes(createStrictValidationPipe());
  app.useGlobalInterceptors(new TransformInterceptor(reflector));
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  return app;
}
