import { Equals, IsOptional } from 'class-validator';

export class PayInvoiceDTO {
  @IsOptional()
  @Equals('PAID')
  status?: 'PAID';
}
