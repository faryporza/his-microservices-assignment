import { Test, TestingModule } from '@nestjs/testing';
import { IamHealthChecksController } from '@apps/iam-bc/health-checks.controller';
import { IamHealthChecksService } from '@apps/iam-bc/health-checks.service';

describe('IamHealthChecksController', () => {
  let controller: IamHealthChecksController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IamHealthChecksController],
      providers: [IamHealthChecksService],
    }).compile();

    controller = module.get<IamHealthChecksController>(
      IamHealthChecksController,
    );
  });

  it('should return "Hello World!"', () => {
    expect(controller.getHello()).toBe('Hello World!');
  });

  it('should return service health status', () => {
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('iam-bc');
    expect(result.timestamp).toBeDefined();
  });
});
