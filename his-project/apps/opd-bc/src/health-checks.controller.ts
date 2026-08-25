import { Controller, Get } from '@nestjs/common';
import { Public } from '@app/common';
import { OpdHealthChecksService } from './health-checks.service';

@Controller()
export class OpdHealthChecksController {
  constructor(private readonly healthChecksService: OpdHealthChecksService) {}

  @Public()
  @Get()
  getHello(): string {
    return this.healthChecksService.getHello();
  }
}
