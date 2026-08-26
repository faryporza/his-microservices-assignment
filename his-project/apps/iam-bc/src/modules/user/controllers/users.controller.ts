import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiStandardErrorResponse,
  ApiSuccessResponse,
  RequirePermission,
  ResourceType,
  Roles,
  UserRole,
} from '@app/common';
import { UsersService } from '../services/users.service';
import { UpdateUserRoleDTO } from '../dto/update-user-role.dto';
import { UpdateUserPatientDTO } from '../dto/update-user-patient.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch(':id/role')
  @Roles(UserRole.ADMIN)
  @RequirePermission('user:role:update')
  @HttpCode(HttpStatus.OK)
  @ResourceType('users')
  @ApiOperation({ summary: 'Update a user role (Admin only)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'User role updated successfully',
  })
  @ApiStandardErrorResponse({
    status: 403,
    description: 'Forbidden: requires administrative privileges',
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: 'User not found',
  })
  async updateRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDTO) {
    return this.toPublicUser(await this.usersService.updateRole(id, dto.role));
  }

  @Patch(':id/patient')
  @Roles(UserRole.ADMIN)
  @RequirePermission('user:patient:link')
  @HttpCode(HttpStatus.OK)
  @ResourceType('users')
  @ApiOperation({ summary: 'Link a user to an OPD patient identity' })
  @ApiSuccessResponse({
    status: 200,
    description: 'User patient identity linked successfully',
  })
  async updatePatient(
    @Param('id') id: string,
    @Body() dto: UpdateUserPatientDTO,
  ) {
    return this.toPublicUser(
      await this.usersService.updatePatientId(id, dto.patient_id),
    );
  }

  private toPublicUser(user: {
    id: string;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    patient_id?: string | null;
    role: UserRole;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
  }) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      patient_id: user.patient_id ?? null,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }
}
