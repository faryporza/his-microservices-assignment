import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CompleteTreatmentDTO {
  @ApiProperty({
    description: 'Doctor Identifier',
    example: 'DOC-001',
  })
  @IsString()
  @IsNotEmpty({ message: 'doctor_id is required' })
  doctor_id!: string;

  @ApiProperty({
    description: 'Final medical diagnosis',
    example: 'Acute Pharyngitis',
  })
  @IsString()
  @IsNotEmpty({ message: 'diagnosis is required' })
  diagnosis!: string;

  @ApiPropertyOptional({
    description: 'Final treatment note or prescription details',
    example: 'Completed antibiotic course, patient fully recovered',
  })
  @IsOptional()
  @IsString()
  treatment_note?: string;

  @ApiProperty({
    description: 'Treatment cost amount in THB',
    example: 1500.0,
    minimum: 0,
  })
  @IsNumber({}, { message: 'treatment_cost must be a number' })
  @Min(0, { message: 'treatment_cost cannot be negative' })
  treatment_cost!: number;
}
