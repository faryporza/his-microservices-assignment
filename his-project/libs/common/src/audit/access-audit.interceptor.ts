import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable, from, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { AuditOutcome } from './entities/audit-log.entity';
import { RESOURCE_TYPE_KEY } from '../response/decorators/resource-type.decorator';
import { getResourceId, getUser } from '../logging/http.logging';

/**
 * Queues an attributable access audit event for successful and handler-level
 * denied resource requests. The event is written through the local outbox and
 * delivered to IAM; no bounded context opens the IAM database directly.
 */
@Injectable()
export class AccessAuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const resourceType = this.reflector.getAllAndOverride<string>(
      RESOURCE_TYPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    const request = context.switchToHttp().getRequest<
      Request & {
        user?: { id?: unknown; role?: unknown };
      }
    >();
    const user = getUser(request);

    if (!resourceType || !user) {
      return next.handle();
    }

    const action = `${request.method.toUpperCase()}_${resourceType.replace(
      /-/g,
      '_',
    )}`;
    const resourceId = getResourceId(request) ?? 'collection';

    const handlerResult = next.handle().pipe(
      catchError((error: unknown) =>
        from(
          this.auditService.logAccess({
            actorId: user.id,
            actorRole: user.role ?? 'UNKNOWN',
            action,
            resourceType,
            resourceId,
            ipAddress: request.ip ?? null,
            outcome: AuditOutcome.DENIED,
          }),
        ).pipe(
          mergeMap(() => throwError(() => error)),
          catchError(() => throwError(() => error)),
        ),
      ),
    );

    return handlerResult.pipe(
      mergeMap((result: unknown) =>
        from(
          this.auditService.logAccess({
            actorId: user.id,
            actorRole: user.role ?? 'UNKNOWN',
            action,
            resourceType,
            resourceId,
            ipAddress: request.ip ?? null,
            outcome: AuditOutcome.GRANTED,
          }),
        ).pipe(mergeMap(() => from([result]))),
      ),
    );
  }
}
