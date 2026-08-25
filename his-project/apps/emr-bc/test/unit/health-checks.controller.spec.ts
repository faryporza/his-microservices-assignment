import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@app/common';
import { EmrHealthChecksController } from '@apps/emr-bc/health-checks.controller';
import { EmrHealthChecksService } from '@apps/emr-bc/health-checks.service';

describe('EmrHealthChecksController', () => {
  let healthChecksController: EmrHealthChecksController;
  const reflector = new Reflector();

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [EmrHealthChecksController],
      providers: [EmrHealthChecksService],
    }).compile();

    healthChecksController = app.get<EmrHealthChecksController>(
      EmrHealthChecksController,
    );
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(healthChecksController.getHello()).toBe('Hello World!');
    });

    it('should have @Public() metadata', () => {
      const isPublic = reflector.get<boolean>(
        IS_PUBLIC_KEY,
        EmrHealthChecksController.prototype.getHello,
      );
      expect(isPublic).toBe(true);
    });
  });
});
