import { Controller, Get } from '@nestjs/common';
import { EmrHealthChecksService } from './health-checks.service';

@Controller()
export class EmrHealthChecksController {
  constructor(private readonly healthChecksService: EmrHealthChecksService) {}

  @Get()
  getHello(): string {
    return this.healthChecksService.getHello();
  }
}
