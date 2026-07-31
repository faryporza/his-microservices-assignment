import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateVisitDto {
  @IsNotEmpty({ message: 'patientId is required' })
  @IsUUID('4', { message: 'patientId must be a valid UUID' })
  patientId!: string;
}
