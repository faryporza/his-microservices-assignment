import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePatientDTO {
  @ApiProperty({ description: 'Hospital Number', example: 'HN-0001' })
  @IsNotEmpty({ message: 'HN is required' })
  @IsString()
  hn!: string;

  @ApiProperty({ description: 'First name', example: 'Somchai' })
  @IsNotEmpty({ message: 'First name is required' })
  @IsString()
  first_name!: string;

  @ApiProperty({ description: 'Last name', example: 'Jaidee' })
  @IsNotEmpty({ message: 'Last name is required' })
  @IsString()
  last_name!: string;

  @ApiProperty({
    description: 'National ID Card Number',
    example: '1234567890123',
  })
  @IsNotEmpty({ message: 'ID Card is required' })
  @IsString()
  id_card!: string;
}
