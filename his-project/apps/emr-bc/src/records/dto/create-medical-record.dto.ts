import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsNumber,
  Min,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { RecordStatus } from '../entities/medical-record.entity';

export class CreateMedicalRecordDto {
  @IsNotEmpty({ message: 'visitId is required' })
  @IsUUID('4', { message: 'visitId must be a valid UUID' })
  visitId!: string;

  @IsOptional()
  @IsUUID('4', { message: 'patientId must be a valid UUID' })
  patientId?: string;

  @IsNotEmpty({ message: 'doctorId is required' })
  @IsString()
  doctorId!: string;

  @IsNotEmpty({ message: 'diagnosis is required' })
  @IsString()
  diagnosis!: string;

  @IsOptional()
  @IsString()
  treatmentNote?: string;

  @IsNotEmpty({ message: 'treatmentCost is required' })
  @IsNumber({}, { message: 'treatmentCost must be a number' })
  @Min(0, { message: 'treatmentCost cannot be negative' })
  treatmentCost!: number;

  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}
