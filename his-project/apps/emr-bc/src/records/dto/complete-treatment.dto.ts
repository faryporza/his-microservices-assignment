import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CompleteTreatmentDto {
  @IsString()
  @IsNotEmpty({ message: 'doctorId is required' })
  doctorId!: string;

  @IsString()
  @IsNotEmpty({ message: 'diagnosis is required' })
  diagnosis!: string;

  @IsOptional()
  @IsString()
  treatmentNote?: string;

  @IsNumber({}, { message: 'treatmentCost must be a number' })
  @Min(0, { message: 'treatmentCost cannot be negative' })
  treatmentCost!: number;
}
