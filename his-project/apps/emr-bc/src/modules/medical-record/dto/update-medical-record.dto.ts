import { PartialType } from '@nestjs/swagger';
import { CreateMedicalRecordDTO } from './create-medical-record.dto';

export class UpdateMedicalRecordDTO extends PartialType(
  CreateMedicalRecordDTO,
) {}
