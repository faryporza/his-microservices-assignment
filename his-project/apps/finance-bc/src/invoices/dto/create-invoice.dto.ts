import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

// This DTO is for service/event use only. It is deliberately not exposed by a
// public controller; invoices are created from treatment.completed in Week 2.
export class CreateInvoiceDto {
  @IsNotEmpty()
  @IsString()
  visitId!: string;

  @IsOptional()
  @IsString()
  recordId?: string;

  // Event payloads may deserialize a JSON number. The service normalizes its
  // string representation without doing floating-point arithmetic.
  @IsNotEmpty()
  totalAmount!: string | number;
}
