import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ResourceType } from '@app/common';
import { InvoicesService } from '../services/invoices.service';
import { PayInvoiceDTO } from '../dto/pay-invoice.dto';

@ApiTags('Invoices')
@ResourceType('invoices')
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @ApiOperation({ summary: 'Retrieve all invoices' })
  @ApiOkResponse({ description: 'List of all invoices' })
  findAll() {
    return this.invoicesService.findAll();
  }

  @Get(':visitId')
  @ApiOperation({ summary: 'Retrieve invoices by visit ID' })
  @ApiParam({
    name: 'visitId',
    description: 'Visit UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'List of invoices for the specified visit' })
  findByVisitId(
    @Param('visitId', new ParseUUIDPipe({ version: '4' })) visitId: string,
  ) {
    return this.invoicesService.findByVisitId(visitId);
  }

  @Patch(':id/pay')
  @ApiOperation({
    summary: 'Process invoice payment and trigger paid event',
  })
  @ApiParam({
    name: 'id',
    description: 'Invoice UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiHeader({
    name: 'x-correlation-id',
    description: 'Correlation ID for distributed tracing',
    required: false,
  })
  @ApiHeader({
    name: 'x-trace-id',
    description: 'Trace ID for distributed tracing',
    required: false,
  })
  @ApiOkResponse({ description: 'Invoice payment processed successfully' })
  @ApiNotFoundResponse({ description: 'Invoice not found' })
  pay(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() _payInvoiceDto: PayInvoiceDTO,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-trace-id') traceId?: string,
  ) {
    return this.invoicesService.pay(id, correlationId, traceId);
  }
}
