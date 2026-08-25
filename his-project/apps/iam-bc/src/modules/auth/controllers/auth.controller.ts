import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, Public, ResourceType } from '@app/common';
import type { AuthenticatedUser } from '@app/common';
import { AuthService, UserResponse } from '../services/auth.service';
import { RegisterUserDTO } from '../dto/register-user.dto';
import { LoginUserDTO } from '../dto/login-user.dto';
import { RefreshTokenDTO } from '../dto/refresh-token.dto';
import { TokenPair } from '../interfaces/token-pair.interface';

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

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ResourceType('tokens')
  @ApiOperation({ summary: 'Authenticate user and issue token pair' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User authenticated successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials or disabled account',
  })
  async login(@Body() dto: LoginUserDTO): Promise<TokenPair> {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ResourceType('tokens')
  @ApiOperation({ summary: 'Rotate refresh token and issue new token pair' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token pair refreshed successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid, expired, or reused refresh token',
  })
  async refresh(@Body() dto: RefreshTokenDTO): Promise<TokenPair> {
    return this.authService.refreshToken(dto);
  }

  @Post('logout')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke active session and blacklist access token' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Logged out successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ message: string }> {
    return this.authService.logout(user);
  }

  @Get('me')
  @ApiBearerAuth()
  @ResourceType('users')
  @ApiOperation({ summary: 'Get profile of currently authenticated user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<UserResponse> {
    return this.authService.getProfile(user);
  }
}
