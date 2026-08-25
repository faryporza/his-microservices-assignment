import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { UsersService } from '../../user/services/users.service';
import { PasswordHashService } from './password-hash.service';
import { RegisterUserDTO } from '../dto/register-user.dto';
import { LoginUserDTO } from '../dto/login-user.dto';
import { RefreshTokenDTO } from '../dto/refresh-token.dto';
import { TokenPair } from '../interfaces/token-pair.interface';
import {
  AuthenticatedUser,
  RedisService,
  SessionMetadata,
  StructuredLogger,
  UserRole,
} from '@app/common';

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface RefreshTokenPayload {
  sub: string;
  sid: string;
  jti: string;
  type?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new StructuredLogger('auth-service');
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly accessExpiresInSeconds = 900; // 15m
  private readonly refreshExpiresInSeconds = 7 * 24 * 60 * 60; // 7 days (604800s)

  constructor(
    private readonly usersService: UsersService,
    private readonly passwordHashService: PasswordHashService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret = this.configService.get<string>(
      'JWT_SECRET',
      'his-secret-jwt-key-for-development-change-in-production',
    );
    this.jwtRefreshSecret = this.configService.get<string>(
      'JWT_REFRESH_SECRET',
      'his-refresh-secret-jwt-key-for-development',
    );
  }

  async register(dto: RegisterUserDTO): Promise<UserResponse> {
    const passwordHash = await this.passwordHashService.hashPassword(
      dto.password,
    );

    const user = await this.usersService.create({
      username: dto.username,
      email: dto.email,
      password_hash: passwordHash,
      first_name: dto.first_name,
      last_name: dto.last_name,
      role: dto.role ?? UserRole.PATIENT,
    });

    this.logger.log({
      message: 'User registered successfully',
      context: {
        action: 'USER_REGISTERED',
        user_id: user.id,
        username: user.username,
        role: user.role,
      },
    });

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  async login(dto: LoginUserDTO): Promise<TokenPair> {
    const user = await this.usersService.findByUsernameOrEmail(dto.username);

    if (!user) {
      this.logger.warn({
        message: 'Login attempt failed: user not found',
        context: {
          action: 'LOGIN_FAILED',
          username: dto.username,
        },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.is_active) {
      this.logger.warn({
        message: 'Login attempt failed: account disabled',
        context: {
          action: 'LOGIN_FAILED',
          user_id: user.id,
        },
      });
      throw new UnauthorizedException('Account is disabled');
    }

    const isPasswordValid = await this.passwordHashService.verifyPassword(
      dto.password,
      user.password_hash,
    );

    if (!isPasswordValid) {
      this.logger.warn({
        message: 'Login attempt failed: password mismatch',
        context: {
          action: 'LOGIN_FAILED',
          user_id: user.id,
        },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const sessionId = randomUUID();
    const accessJti = randomUUID();
    const refreshJti = randomUUID();

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        username: user.username,
        role: user.role,
        sid: sessionId,
        jti: accessJti,
        email: user.email,
      },
      {
        secret: this.jwtSecret,
        expiresIn: `${this.accessExpiresInSeconds}s`,
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        sid: sessionId,
        jti: refreshJti,
        type: 'refresh',
      },
      {
        secret: this.jwtRefreshSecret,
        expiresIn: `${this.refreshExpiresInSeconds}s`,
      },
    );

    const sessionMetadata: SessionMetadata = {
      userId: user.id,
      username: user.username,
      role: user.role,
      refreshTokenJti: refreshJti,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(
        Date.now() + this.refreshExpiresInSeconds * 1000,
      ).toISOString(),
    };

    await this.redisService.createSession(
      user.id,
      sessionId,
      sessionMetadata,
      this.refreshExpiresInSeconds,
    );

    this.logger.log({
      message: 'User logged in successfully',
      context: {
        action: 'USER_LOGGED_IN',
        user_id: user.id,
        username: user.username,
        role: user.role,
        session_id: sessionId,
      },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: this.accessExpiresInSeconds,
    };
  }

  async refreshToken(dto: RefreshTokenDTO): Promise<TokenPair> {
    let payload: RefreshTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        dto.refresh_token,
        {
          secret: this.jwtRefreshSecret,
        },
      );
    } catch {
      this.logger.warn({
        message: 'Refresh token verification failed',
        context: { action: 'TOKEN_REFRESH_FAILED' },
      });
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (
      payload.type !== 'refresh' ||
      !payload.sub ||
      !payload.sid ||
      !payload.jti
    ) {
      this.logger.warn({
        message: 'Invalid refresh token payload claims',
        context: { action: 'TOKEN_REFRESH_FAILED', user_id: payload.sub },
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.redisService.getSession(
      payload.sub,
      payload.sid,
    );

    if (!session) {
      this.logger.warn({
        message: 'Session not found for refresh token',
        context: {
          action: 'TOKEN_REFRESH_FAILED',
          user_id: payload.sub,
          session_id: payload.sid,
        },
      });
      throw new UnauthorizedException('Session has expired or been revoked');
    }

    // REPLAY DETECTION: Token reuse check
    if (session.refreshTokenJti !== payload.jti) {
      this.logger.error({
        message:
          'SECURITY ALERT: Refresh token reuse/replay detected! Revoking all sessions.',
        context: {
          action: 'REFRESH_TOKEN_REUSE_DETECTED',
          user_id: payload.sub,
          session_id: payload.sid,
          attempted_jti: payload.jti,
          expected_jti: session.refreshTokenJti,
        },
      });
      await this.redisService.revokeAllUserSessions(payload.sub);
      throw new UnauthorizedException(
        'Token reuse detected. All sessions have been revoked.',
      );
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.is_active) {
      this.logger.warn({
        message: 'Refresh attempt failed: user inactive or not found',
        context: { action: 'TOKEN_REFRESH_FAILED', user_id: payload.sub },
      });
      throw new UnauthorizedException('Account is disabled or not found');
    }

    const newAccessJti = randomUUID();
    const newRefreshJti = randomUUID();

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        username: user.username,
        role: user.role,
        sid: payload.sid,
        jti: newAccessJti,
        email: user.email,
      },
      {
        secret: this.jwtSecret,
        expiresIn: `${this.accessExpiresInSeconds}s`,
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        sid: payload.sid,
        jti: newRefreshJti,
        type: 'refresh',
      },
      {
        secret: this.jwtRefreshSecret,
        expiresIn: `${this.refreshExpiresInSeconds}s`,
      },
    );

    const updatedSession: SessionMetadata = {
      ...session,
      refreshTokenJti: newRefreshJti,
      expiresAt: new Date(
        Date.now() + this.refreshExpiresInSeconds * 1000,
      ).toISOString(),
    };

    await this.redisService.createSession(
      user.id,
      payload.sid,
      updatedSession,
      this.refreshExpiresInSeconds,
    );

    this.logger.log({
      message: 'Token pair refreshed successfully',
      context: {
        action: 'TOKEN_REFRESHED',
        user_id: user.id,
        session_id: payload.sid,
      },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: this.accessExpiresInSeconds,
    };
  }

  async logout(userPayload: AuthenticatedUser): Promise<{ message: string }> {
    if (userPayload.jti) {
      await this.redisService.blacklistAccessToken(
        userPayload.jti,
        this.accessExpiresInSeconds,
      );
    }

    if (userPayload.id && userPayload.sessionId) {
      await this.redisService.revokeSession(
        userPayload.id,
        userPayload.sessionId,
      );
    }

    this.logger.log({
      message: 'User logged out successfully',
      context: {
        action: 'USER_LOGGED_OUT',
        user_id: userPayload.id,
        session_id: userPayload.sessionId,
      },
    });

    return { message: 'Logged out successfully' };
  }

  async getProfile(userPayload: AuthenticatedUser): Promise<UserResponse> {
    const user = await this.usersService.findById(userPayload.id);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }
}
