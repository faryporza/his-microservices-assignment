import { Test, TestingModule } from '@nestjs/testing';
import { EmrBcController } from './emr-bc.controller';
import { EmrBcService } from './emr-bc.service';

describe('EmrBcController', () => {
  let emrBcController: EmrBcController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [EmrBcController],
      providers: [EmrBcService],
    }).compile();

    emrBcController = app.get<EmrBcController>(EmrBcController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(emrBcController.getHello()).toBe('Hello World!');
    });
  });
});
