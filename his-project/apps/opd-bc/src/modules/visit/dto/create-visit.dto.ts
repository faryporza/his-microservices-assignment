import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateVisitDTO {
  @IsNotEmpty({ message: 'patient_id is required' })
  @IsUUID('4', { message: 'patient_id must be a valid UUID' })
  patient_id!: string;
}
