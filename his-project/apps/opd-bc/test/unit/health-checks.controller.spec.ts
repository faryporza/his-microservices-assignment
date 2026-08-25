import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@app/common';
import { OpdHealthChecksController } from '@apps/opd-bc/health-checks.controller';
import { OpdHealthChecksService } from '@apps/opd-bc/health-checks.service';

describe('OpdHealthChecksController', () => {
  let healthChecksController: OpdHealthChecksController;
  const reflector = new Reflector();

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [OpdHealthChecksController],
      providers: [OpdHealthChecksService],
    }).compile();

    healthChecksController = app.get<OpdHealthChecksController>(
      OpdHealthChecksController,
    );
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(healthChecksController.getHello()).toBe('Hello World!');
    });

    it('should have @Public() metadata', () => {
      const isPublic = reflector.get<boolean>(
        IS_PUBLIC_KEY,
        OpdHealthChecksController.prototype.getHello,
      );
      expect(isPublic).toBe(true);
    });
  });
});
