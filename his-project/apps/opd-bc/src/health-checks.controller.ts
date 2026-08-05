import { Controller, Get } from '@nestjs/common';
import { OpdHealthChecksService } from './health-checks.service';

@Controller()
export class OpdHealthChecksController {
  constructor(private readonly healthChecksService: OpdHealthChecksService) {}

  @Get()
  getHello(): string {
    return this.healthChecksService.getHello();
  }
}
