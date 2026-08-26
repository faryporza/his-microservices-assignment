import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  CheckResourceOwnership,
  CurrentUser,
  RequirePermission,
  ResourceType,
  Roles,
  ApiSuccessResponse,
  UserRole,
} from '@app/common';
import type { AuthenticatedUser } from '@app/common';
import { InvoicesService } from '../services/invoices.service';
import { PayInvoiceDTO } from '../dto/pay-invoice.dto';

@ApiTags('Invoices')
@ApiBearerAuth()
@ResourceType('invoices')
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.FINANCE_STAFF)
  @RequirePermission('invoice:read')
  @ApiOperation({ summary: 'Retrieve all invoices' })
  @ApiSuccessResponse({ description: 'List of all invoices' })
  findAll() {
    return this.invoicesService.findAll();
  }

  @Get(':visitId')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.FINANCE_STAFF, UserRole.PATIENT)
  @RequirePermission('invoice:read')
  @CheckResourceOwnership('invoice', 'visitId')
  @ApiOperation({ summary: 'Retrieve invoices by visit ID' })
  @ApiParam({
    name: 'visitId',
    description: 'Visit UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiSuccessResponse({
    description: 'List of invoices for the specified visit',
  })
  findByVisitId(
    @Param('visitId', new ParseUUIDPipe({ version: '4' })) visitId: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return user
      ? this.invoicesService.findByVisitId(visitId, user)
      : this.invoicesService.findByVisitId(visitId);
  }

  @Patch(':id/pay')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.FINANCE_STAFF)
  @RequirePermission('invoice:pay')
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
  @ApiSuccessResponse({
    description: 'Invoice payment processed successfully',
  })
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
