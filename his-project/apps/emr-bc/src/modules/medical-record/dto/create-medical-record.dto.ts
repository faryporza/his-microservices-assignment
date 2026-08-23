import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { RecordStatus } from '../entities/medical-record.entity';

export class CreateMedicalRecordDTO {
  @ApiProperty({
    description: 'Visit UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsNotEmpty({ message: 'visit_id is required' })
  @IsUUID('4', { message: 'visit_id must be a valid UUID' })
  visit_id!: string;

  @ApiPropertyOptional({
    description: 'Patient UUID',
    example: '7ba7b810-9dad-41d1-80b4-00c04fd430c8',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4', { message: 'patient_id must be a valid UUID' })
  patient_id?: string;

  @ApiProperty({
    description: 'Doctor Identifier',
    example: 'DOC-001',
  })
  @IsNotEmpty({ message: 'doctor_id is required' })
  @IsString()
  doctor_id!: string;

  @ApiProperty({
    description: 'Medical diagnosis description',
    example: 'Acute Pharyngitis',
  })
  @IsNotEmpty({ message: 'diagnosis is required' })
  @IsString()
  diagnosis!: string;

  @ApiPropertyOptional({
    description: 'Treatment notes or prescription details',
    example: 'Prescribed Amoxicillin 500mg, rest for 3 days',
  })
  @IsOptional()
  @IsString()
  treatment_note?: string;

  @ApiProperty({
    description: 'Treatment cost amount in THB',
    example: 1500.0,
    minimum: 0,
  })
  @IsNotEmpty({ message: 'treatment_cost is required' })
  @IsNumber({}, { message: 'treatment_cost must be a number' })
  @Min(0, { message: 'treatment_cost cannot be negative' })
  treatment_cost!: number;

  @ApiPropertyOptional({
    description: 'Record status',
    enum: RecordStatus,
    example: RecordStatus.COMPLETED,
  })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}
