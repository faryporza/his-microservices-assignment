import { Controller, Get } from '@nestjs/common';
import { EmrBcService } from './emr-bc.service';

@Controller()
export class EmrBcController {
  constructor(private readonly emrBcService: EmrBcService) {}

  @Get()
  getHello(): string {
    return this.emrBcService.getHello();
  }
}
