import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePatientDto {
  @IsNotEmpty({ message: 'HN is required' })
  @IsString()
  hn!: string;

  @IsNotEmpty({ message: 'First name is required' })
  @IsString()
  firstName!: string;

  @IsNotEmpty({ message: 'Last name is required' })
  @IsString()
  lastName!: string;

  @IsNotEmpty({ message: 'ID Card is required' })
  @IsString()
  idCard!: string;
}
