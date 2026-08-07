import { Test, TestingModule } from '@nestjs/testing';
import { OpdHealthChecksController } from '@apps/opd-bc/health-checks.controller';
import { OpdHealthChecksService } from '@apps/opd-bc/health-checks.service';

describe('OpdHealthChecksController', () => {
  let healthChecksController: OpdHealthChecksController;

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
  });
});
