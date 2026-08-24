import { PartialType } from '@nestjs/swagger';
import { CreatePatientDTO } from './create-patient.dto';

export class UpdatePatientDTO extends PartialType(CreatePatientDTO) {}
