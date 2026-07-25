import { Controller, Get, Param } from '@nestjs/common';
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
}
