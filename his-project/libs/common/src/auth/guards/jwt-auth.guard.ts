import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { RedisService } from '../../redis/redis.service';
import { UserRole } from '../constants/user-roles.enum';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { StructuredLogger } from '../../logging/structured.logger';

interface JwtPayload {
  sub: string;
  username: string;
  role: UserRole;
  sid?: string;
  jti?: string;
  email?: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new StructuredLogger('jwt-auth-guard');

  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: AuthenticatedUser;
    }>();

    const authHeader =
      request.headers['authorization'] || request.headers['Authorization'];

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException(
        'Missing or invalid authorization header',
      );
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException(
        'Missing or invalid authorization header',
      );
    }

    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    try {
      if (payload.jti) {
        const isBlacklisted = await this.redisService.isAccessTokenBlacklisted(
          payload.jti,
        );
        if (isBlacklisted) {
          throw new UnauthorizedException('Session has been revoked');
        }
      }

      if (payload.sub && payload.sid) {
        const session = await this.redisService.getSession(
          payload.sub,
          payload.sid,
        );
        if (!session) {
          throw new UnauthorizedException(
            'Session has been revoked or expired',
          );
        }
      }
    } catch (err: unknown) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      this.logger.error('Redis session verification failure', {
        action: 'AUTH_SESSION_VERIFICATION_FAILED',
        user_id: payload.sub,
        error: err instanceof Error ? err : new Error(String(err)),
      });
      throw new ServiceUnavailableException(
        'Authentication session service unavailable',
      );
    }

    request.user = {
      id: payload.sub,
      username: payload.username,
      role: payload.role,
      sessionId: payload.sid,
      jti: payload.jti,
      email: payload.email,
    };

    return true;
  }
}
