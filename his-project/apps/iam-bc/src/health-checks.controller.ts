import { Controller, Get } from '@nestjs/common';
import { Public } from '@app/common';
import { IamHealthChecksService } from './health-checks.service';

@Controller()
export class IamHealthChecksController {
  constructor(private readonly healthChecksService: IamHealthChecksService) {}

  @Public()
  @Get()
  getHello(): string {
    return this.healthChecksService.getHello();
  }

  @Public()
  @Get('health')
  check() {
    return this.healthChecksService.getHealth();
  }
}
