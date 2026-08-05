import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePatientDTO {
  @IsNotEmpty({ message: 'HN is required' })
  @IsString()
  hn!: string;

  @IsNotEmpty({ message: 'First name is required' })
  @IsString()
  first_name!: string;

  @IsNotEmpty({ message: 'Last name is required' })
  @IsString()
  last_name!: string;

  @IsNotEmpty({ message: 'ID Card is required' })
  @IsString()
  id_card!: string;
}
