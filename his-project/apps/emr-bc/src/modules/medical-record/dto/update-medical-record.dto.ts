import { IsString, IsNumber, Min, IsOptional, IsEnum } from 'class-validator';
import { RecordStatus } from '../entities/medical-record.entity';

export class UpdateMedicalRecordDTO {
  @IsOptional()
  @IsString()
  doctor_id?: string;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsString()
  treatment_note?: string;

  @IsOptional()
  @IsNumber({}, { message: 'treatment_cost must be a number' })
  @Min(0, { message: 'treatment_cost cannot be negative' })
  treatment_cost?: number;

  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}
