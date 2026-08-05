import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { PayInvoiceDTO } from './dto/pay-invoice.dto';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  findAll() {
    return this.invoicesService.findAll();
  }

  @Get(':visitId')
  findByVisitId(
    @Param('visitId', new ParseUUIDPipe({ version: '4' })) visitId: string,
  ) {
    return this.invoicesService.findByVisitId(visitId);
  }

  @Patch(':id/pay')
  pay(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() _payInvoiceDto: PayInvoiceDTO,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-trace-id') traceId?: string,
  ) {
    return this.invoicesService.pay(id, correlationId, traceId);
  }
}
