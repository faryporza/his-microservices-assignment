import { Controller, Get } from '@nestjs/common';
import { Public } from '@app/common';
import { FinanceHealthChecksService } from './health-checks.service';

@Controller()
export class FinanceHealthChecksController {
  constructor(
    private readonly healthChecksService: FinanceHealthChecksService,
  ) {}

  @Public()
  @Get()
  getHello(): string {
    return this.healthChecksService.getHello();
  }
}
