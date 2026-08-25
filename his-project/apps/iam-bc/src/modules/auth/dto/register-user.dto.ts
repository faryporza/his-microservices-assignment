import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@app/common';

export class RegisterUserDTO {
  @ApiProperty({
    description: 'Unique username for authentication',
    example: 'john_doe',
    minLength: 3,
    maxLength: 50,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username: string;

  @ApiProperty({
    description: 'Unique email address',
    example: 'john@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description:
      'Password meeting minimum complexity (8+ chars, uppercase, lowercase, digit/symbol)',
    example: 'P@ssword123',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number or special character',
  })
  password: string;

  @ApiProperty({
    description: 'User first name',
    example: 'John',
  })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
  })
  @IsString()
  @IsNotEmpty()
  last_name: string;

  @ApiPropertyOptional({
    description: 'Assigned system role',
    enum: UserRole,
    default: UserRole.PATIENT,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
