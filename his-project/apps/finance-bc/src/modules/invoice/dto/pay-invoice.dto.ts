import { ApiPropertyOptional } from '@nestjs/swagger';
import { Equals, IsOptional } from 'class-validator';

export class PayInvoiceDTO {
  @ApiPropertyOptional({
    description: 'Payment status value',
    enum: ['PAID'],
    example: 'PAID',
  })
  @IsOptional()
  @Equals('PAID')
  status?: 'PAID';
}
