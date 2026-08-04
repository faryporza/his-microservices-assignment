import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CompleteTreatmentDto {
  @IsString()
  @IsNotEmpty({ message: 'doctor_id is required' })
  doctor_id!: string;

  @IsString()
  @IsNotEmpty({ message: 'diagnosis is required' })
  diagnosis!: string;

  @IsOptional()
  @IsString()
  treatment_note?: string;

  @IsNumber({}, { message: 'treatment_cost must be a number' })
  @Min(0, { message: 'treatment_cost cannot be negative' })
  treatment_cost!: number;
}
