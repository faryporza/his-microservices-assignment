import { IsString, IsNumber, Min, IsOptional, IsEnum } from 'class-validator';
import { RecordStatus } from '../entities/medical-record.entity';

export class UpdateMedicalRecordDto {
  @IsOptional()
  @IsString()
  doctorId?: string;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsString()
  treatmentNote?: string;

  @IsOptional()
  @IsNumber({}, { message: 'treatmentCost must be a number' })
  @Min(0, { message: 'treatmentCost cannot be negative' })
  treatmentCost?: number;

  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}
