import { Controller, Get } from '@nestjs/common';
import { FinanceHealthChecksService } from './health-checks.service';

@Controller()
export class FinanceHealthChecksController {
  constructor(
    private readonly healthChecksService: FinanceHealthChecksService,
  ) {}

  @Get()
  getHello(): string {
    return this.healthChecksService.getHello();
  }
}
