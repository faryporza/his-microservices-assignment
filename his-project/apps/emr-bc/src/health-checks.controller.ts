import { Controller, Get } from '@nestjs/common';
import { Public } from '@app/common';
import { EmrHealthChecksService } from './health-checks.service';

@Controller()
export class EmrHealthChecksController {
  constructor(private readonly healthChecksService: EmrHealthChecksService) {}

  @Public()
  @Get()
  getHello(): string {
    return this.healthChecksService.getHello();
  }
}
