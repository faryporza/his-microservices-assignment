import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdatePatientDTO {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  hn?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  first_name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  last_name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  id_card?: string;
}
