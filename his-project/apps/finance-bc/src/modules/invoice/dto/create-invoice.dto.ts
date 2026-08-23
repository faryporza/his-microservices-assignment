import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

// This DTO is for service/event use only. It is deliberately not exposed by a
// public controller; invoices are created from treatment.completed in Week 2.
export class CreateInvoiceDTO {
  @ApiProperty({
    description: 'Visit UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsNotEmpty()
  @IsUUID('4')
  visit_id!: string;

  @ApiPropertyOptional({
    description: 'Medical Record UUID',
    example: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  record_id?: string;

  // Event payloads may deserialize a JSON number. The service normalizes its
  // string representation without doing floating-point arithmetic.
  @ApiProperty({
    description: 'Total invoice amount in THB',
    example: 1500.0,
  })
  @IsNotEmpty()
  total_amount!: string | number;
}
