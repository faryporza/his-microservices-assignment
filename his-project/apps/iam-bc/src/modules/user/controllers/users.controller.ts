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
import { JwtAuthGuard, Roles, RolesGuard, UserRole } from '@app/common';
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
    const user = await this.usersService.updateRole(id, dto.role);
    return {
      data: {
        id: user.id,
        type: 'users',
        attributes: {
          username: user.username,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          is_active: user.is_active,
          created_at: user.created_at,
          updated_at: user.updated_at,
        },
      },
    };
  }
}
