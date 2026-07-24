import { Test, TestingModule } from '@nestjs/testing';
import { OpdBcController } from './opd-bc.controller';
import { OpdBcService } from './opd-bc.service';

describe('OpdBcController', () => {
  let opdBcController: OpdBcController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [OpdBcController],
      providers: [OpdBcService],
    }).compile();

    opdBcController = app.get<OpdBcController>(OpdBcController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(opdBcController.getHello()).toBe('Hello World!');
    });
  });
});
