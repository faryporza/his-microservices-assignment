import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class UpdateUserPatientDTO {
  @ApiProperty({
    description: 'Patient UUID owned by the OPD bounded context',
    format: 'uuid',
  })
  @IsNotEmpty()
  @IsUUID('4')
  patient_id: string;
}
