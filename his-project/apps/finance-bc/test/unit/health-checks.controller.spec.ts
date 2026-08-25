import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@app/common';
import { FinanceHealthChecksController } from '@apps/finance-bc/health-checks.controller';
import { FinanceHealthChecksService } from '@apps/finance-bc/health-checks.service';

describe('FinanceHealthChecksController', () => {
  let healthChecksController: FinanceHealthChecksController;
  const reflector = new Reflector();

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [FinanceHealthChecksController],
      providers: [FinanceHealthChecksService],
    }).compile();

    healthChecksController = app.get<FinanceHealthChecksController>(
      FinanceHealthChecksController,
    );
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(healthChecksController.getHello()).toBe('Hello World!');
    });

    it('should have @Public() metadata', () => {
      const isPublic = reflector.get<boolean>(
        IS_PUBLIC_KEY,
        FinanceHealthChecksController.prototype.getHello,
      );
      expect(isPublic).toBe(true);
    });
  });
});
