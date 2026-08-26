import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@app/common';

export class UpdateUserRoleDTO {
  @ApiProperty({
    description: 'New role assigned to the user',
    enum: UserRole,
    example: UserRole.DOCTOR,
  })
  @IsNotEmpty()
  @IsEnum(UserRole)
  role: UserRole;
}
