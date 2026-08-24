import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateVisitDTO {
  @ApiProperty({
    description: 'Patient UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsNotEmpty({ message: 'patient_id is required' })
  @IsUUID('4', { message: 'patient_id must be a valid UUID' })
  patient_id!: string;
}
