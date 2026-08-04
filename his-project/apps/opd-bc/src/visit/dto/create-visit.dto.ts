import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateVisitDto {
  @IsNotEmpty({ message: 'patient_id is required' })
  @IsUUID('4', { message: 'patient_id must be a valid UUID' })
  patient_id!: string;
}
