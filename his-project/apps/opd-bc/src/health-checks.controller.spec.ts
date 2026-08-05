import { Test, TestingModule } from '@nestjs/testing';
import { OpdHealthChecksController } from './health-checks.controller';
import { OpdHealthChecksService } from './health-checks.service';

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
