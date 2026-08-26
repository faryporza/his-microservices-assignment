import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiStandardErrorResponse,
  ApiSuccessResponse,
  CurrentUser,
  Public,
  RateLimit,
  ResourceType,
} from '@app/common';
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
  @RateLimit({ limit: 5, ttlSeconds: 60 })
  @HttpCode(HttpStatus.CREATED)
  @ResourceType('users')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiSuccessResponse({
    status: HttpStatus.CREATED,
    description: 'User registered successfully',
  })
  @ApiStandardErrorResponse({
    status: HttpStatus.CONFLICT,
    description: 'Username or email already registered',
  })
  @ApiStandardErrorResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation failed',
  })
  async register(@Body() dto: RegisterUserDTO): Promise<UserResponse> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @RateLimit({ limit: 5, ttlSeconds: 60 })
  @HttpCode(HttpStatus.OK)
  @ResourceType('tokens')
  @ApiOperation({ summary: 'Authenticate user and issue token pair' })
  @ApiSuccessResponse({
    status: HttpStatus.OK,
    description: 'User authenticated successfully',
  })
  @ApiStandardErrorResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials or disabled account',
  })
  async login(@Body() dto: LoginUserDTO): Promise<TokenPair> {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @RateLimit({ limit: 10, ttlSeconds: 60 })
  @HttpCode(HttpStatus.OK)
  @ResourceType('tokens')
  @ApiOperation({ summary: 'Rotate refresh token and issue new token pair' })
  @ApiSuccessResponse({
    status: HttpStatus.OK,
    description: 'Token pair refreshed successfully',
  })
  @ApiStandardErrorResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid, expired, or reused refresh token',
  })
  async refresh(@Body() dto: RefreshTokenDTO): Promise<TokenPair> {
    return this.authService.refreshToken(dto);
  }

  @Post('logout')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ResourceType('auth')
  @ApiOperation({ summary: 'Revoke active session and blacklist access token' })
  @ApiSuccessResponse({
    status: HttpStatus.OK,
    description: 'Logged out successfully',
  })
  @ApiStandardErrorResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ message: string }> {
    return this.authService.logout(user);
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ResourceType('users')
  @ApiOperation({ summary: 'Get profile of currently authenticated user' })
  @ApiSuccessResponse({
    status: HttpStatus.OK,
    description: 'Profile retrieved successfully',
  })
  @ApiStandardErrorResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<UserResponse> {
    return this.authService.getProfile(user);
  }
}
