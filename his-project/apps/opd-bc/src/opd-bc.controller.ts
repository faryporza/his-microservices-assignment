import { Controller, Get } from '@nestjs/common';
import { OpdBcService } from './opd-bc.service';

@Controller()
export class OpdBcController {
  constructor(private readonly opdBcService: OpdBcService) {}

  @Get()
  getHello(): string {
    return this.opdBcService.getHello();
  }
}
