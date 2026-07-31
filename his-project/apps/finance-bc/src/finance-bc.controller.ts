import { Controller, Get } from '@nestjs/common';
import { FinanceBcService } from './finance-bc.service';

@Controller()
export class FinanceBcController {
  constructor(private readonly financeBcService: FinanceBcService) {}

  @Get()
  getHello(): string {
    return this.financeBcService.getHello();
  }
}
