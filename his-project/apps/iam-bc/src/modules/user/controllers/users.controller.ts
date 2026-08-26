import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  JwtAuthGuard,
  ResourceType,
  Roles,
  RolesGuard,
  UserRole,
} from '@app/common';
import { UsersService } from '../services/users.service';
import { UpdateUserRoleDTO } from '../dto/update-user-role.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch(':id/role')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ResourceType('users')
  @ApiOperation({ summary: 'Update a user role (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'User role updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: requires administrative privileges',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async updateRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDTO) {
    return this.usersService.updateRole(id, dto.role);
  }
}
