import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public, ResourceType } from '@app/common';
import { AuthService, UserResponse } from '../services/auth.service';
import { RegisterUserDTO } from '../dto/register-user.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ResourceType('users')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User registered successfully',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Username or email already registered',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation failed',
  })
  async register(@Body() dto: RegisterUserDTO): Promise<UserResponse> {
    return this.authService.register(dto);
  }
}
