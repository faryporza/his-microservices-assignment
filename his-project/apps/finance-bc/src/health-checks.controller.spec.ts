import { Test, TestingModule } from '@nestjs/testing';
import { FinanceHealthChecksController } from './health-checks.controller';
import { FinanceHealthChecksService } from './health-checks.service';

describe('FinanceHealthChecksController', () => {
  let healthChecksController: FinanceHealthChecksController;

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
  });
});
