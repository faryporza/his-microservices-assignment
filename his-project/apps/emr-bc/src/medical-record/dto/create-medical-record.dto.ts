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

export class CreateMedicalRecordDTO {
  @IsNotEmpty({ message: 'visit_id is required' })
  @IsUUID('4', { message: 'visit_id must be a valid UUID' })
  visit_id!: string;

  @IsOptional()
  @IsUUID('4', { message: 'patient_id must be a valid UUID' })
  patient_id?: string;

  @IsNotEmpty({ message: 'doctor_id is required' })
  @IsString()
  doctor_id!: string;

  @IsNotEmpty({ message: 'diagnosis is required' })
  @IsString()
  diagnosis!: string;

  @IsOptional()
  @IsString()
  treatment_note?: string;

  @IsNotEmpty({ message: 'treatment_cost is required' })
  @IsNumber({}, { message: 'treatment_cost must be a number' })
  @Min(0, { message: 'treatment_cost cannot be negative' })
  treatment_cost!: number;

  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}
