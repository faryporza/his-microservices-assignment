import { Test, TestingModule } from '@nestjs/testing';
import { EmrHealthChecksController } from '@apps/emr-bc/health-checks.controller';
import { EmrHealthChecksService } from '@apps/emr-bc/health-checks.service';

describe('EmrHealthChecksController', () => {
  let healthChecksController: EmrHealthChecksController;

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
  });
});
