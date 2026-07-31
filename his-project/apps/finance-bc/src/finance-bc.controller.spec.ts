import { Test, TestingModule } from '@nestjs/testing';
import { FinanceBcController } from './finance-bc.controller';
import { FinanceBcService } from './finance-bc.service';

describe('FinanceBcController', () => {
  let financeBcController: FinanceBcController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [FinanceBcController],
      providers: [FinanceBcService],
    }).compile();

    financeBcController = app.get<FinanceBcController>(FinanceBcController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(financeBcController.getHello()).toBe('Hello World!');
    });
  });
});
