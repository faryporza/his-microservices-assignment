import { Controller, Get } from '@nestjs/common';
import { IamHealthChecksService } from './health-checks.service';

@Controller()
export class IamHealthChecksController {
  constructor(private readonly healthChecksService: IamHealthChecksService) {}

  @Get()
  getHello(): string {
    return this.healthChecksService.getHello();
  }

  @Get('health')
  check() {
    return this.healthChecksService.getHealth();
  }
}
