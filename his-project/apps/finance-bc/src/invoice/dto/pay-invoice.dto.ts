import { Equals, IsOptional } from 'class-validator';

export class PayInvoiceDto {
  @IsOptional()
  @Equals('PAID')
  status?: 'PAID';
}
