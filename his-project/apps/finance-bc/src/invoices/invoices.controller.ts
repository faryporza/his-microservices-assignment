import { Controller, Get, Param, Patch } from '@nestjs/common';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  findAll() {
    return this.invoicesService.findAll();
  }

  @Get('id/:id')
  findById(@Param('id') id: string) {
    return this.invoicesService.findById(id);
  }

  @Get(':visitId')
  findByVisitId(@Param('visitId') visitId: string) {
    return this.invoicesService.findByVisitId(visitId);
  }

  @Patch(':id/pay')
  pay(@Param('id') id: string) {
    return this.invoicesService.pay(id);
  }
}
