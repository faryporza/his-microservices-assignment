import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

// This DTO is for service/event use only. It is deliberately not exposed by a
// public controller; invoices are created from treatment.completed in Week 2.
export class CreateInvoiceDto {
  @IsNotEmpty()
  @IsUUID('4')
  visit_id!: string;

  @IsOptional()
  @IsUUID('4')
  record_id?: string;

  // Event payloads may deserialize a JSON number. The service normalizes its
  // string representation without doing floating-point arithmetic.
  @IsNotEmpty()
  total_amount!: string | number;
}
