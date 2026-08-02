import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Injectable,
  NestInterceptor,
  CallHandler,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { Observable, tap } from 'rxjs';
import { isInfrastructureError, StructuredLogger } from './structured-logger';

type RequestWithCorrelation = Request & { correlationId?: string };

export function getOrCreateCorrelationId(
  request: RequestWithCorrelation,
): string {
  const header = request.headers['x-correlation-id'];
  const correlationId = Array.isArray(header) ? header[0] : header;
  const value =
    typeof correlationId === 'string' && correlationId.length <= 128
      ? correlationId
      : randomUUID();

  request.correlationId = value;
  request.headers['x-correlation-id'] = value;
  return value;
}

function getVisitId(request: Request): string | undefined {
  const params = request.params as Record<string, string | undefined>;
  if (params.visitId) {
    return params.visitId;
  }

  const route = request.route?.path?.toString() ?? '';
  return route.includes('visits') ? params.id : undefined;
}

function getEventName(request: Request): string {
  const route = request.route?.path?.toString() ?? request.path;
  return `http.${request.method} ${route}`;
}

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger: StructuredLogger;

  constructor(service: string) {
    this.logger = new StructuredLogger(service);
  }

  intercept(context: ArgumentsHost, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithCorrelation>();
    const response = context.switchToHttp().getResponse<Response>();
    const correlationId = getOrCreateCorrelationId(request);

    return next.handle().pipe(
      tap(() => {
        this.logger.log({
          eventName: getEventName(request),
          correlationId,
          visitId: getVisitId(request),
          status: response.statusCode,
        });
      }),
    );
  }
}

@Catch()
export class HttpLoggingExceptionFilter implements ExceptionFilter {
  private readonly logger: StructuredLogger;

  constructor(private readonly service: string) {
    this.logger = new StructuredLogger(service);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithCorrelation>();
    const response = context.getResponse<Response>();
    const correlationId =
      request.correlationId ?? getOrCreateCorrelationId(request);
    const status = this.getStatus(exception);

    this.logger.error({
      eventName: getEventName(request),
      correlationId,
      visitId: getVisitId(request),
      status,
      error: exception,
    });

    if (exception instanceof HttpException) {
      response.status(status).json(exception.getResponse());
      return;
    }

    response.status(status).json({
      statusCode: status,
      message: status === 503 ? 'Service unavailable' : 'Internal server error',
    });
  }

  private getStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    return isInfrastructureError(exception) ? 503 : 500;
  }
}
