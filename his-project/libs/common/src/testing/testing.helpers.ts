import { INestApplication, Provider, Type } from '@nestjs/common';
import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import { createStrictValidationPipe } from '../validation/strict-validation.pipe';

export function createTestingModule(
  controllers: Type<object>[] = [],
  providers: Provider[] = [],
): TestingModuleBuilder {
  return Test.createTestingModule({
    controllers,
    providers,
  });
}

export function createTestApp(module: TestingModule): INestApplication {
  const app = module.createNestApplication();
  app.useGlobalPipes(createStrictValidationPipe());
  return app;
}
