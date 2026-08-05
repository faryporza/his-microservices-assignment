import {
  ArgumentsHost,
  CallHandler,
  Catch,
  ExceptionFilter,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import {
  isInfrastructureError,
  StructuredLogger,
  StructuredLogUser,
  StructuredTraceContext,
} from './structured.logger';

export interface RequestTraceContext {
  traceId: string;
  spanId: string;
  correlationId: string;
}

type RequestWithTrace = Request & {
  traceContext?: RequestTraceContext;
  user?: {
    id?: unknown;
    role?: unknown;
  };
};

export function getOrCreateTraceContext(
  request: RequestWithTrace,
): RequestTraceContext {
  if (request.traceContext) {
    return request.traceContext;
  }

  const correlationId =
    getTraceHeader(request, 'x-correlation-id') ?? randomUUID();
  const traceId = getTraceHeader(request, 'x-trace-id') ?? randomUUID();
  const traceContext = {
    traceId,
    spanId: randomUUID(),
    correlationId,
  };

  request.traceContext = traceContext;
  request.headers['x-correlation-id'] = correlationId;
  request.headers['x-trace-id'] = traceId;
  request.headers['x-span-id'] = traceContext.spanId;
  return traceContext;
}

export function getOrCreateCorrelationId(request: RequestWithTrace): string {
  return getOrCreateTraceContext(request).correlationId;
}

function getTraceHeader(
  request: Request,
  name: 'x-correlation-id' | 'x-trace-id',
): string | undefined {
  const header = request.headers[name];
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 128
    ? normalized
    : undefined;
}

function setTraceResponseHeaders(
  response: Response,
  trace: RequestTraceContext,
): void {
  response.setHeader('x-correlation-id', trace.correlationId);
  response.setHeader('x-trace-id', trace.traceId);
  response.setHeader('x-span-id', trace.spanId);
}

function getResourceId(request: Request): string | undefined {
  const params = request.params as Record<string, string | undefined>;
  return params.visitId ?? params.patientId ?? params.id;
}

function getRoute(request: Request): string {
  const route = request.route as { path?: unknown } | undefined;
  return typeof route?.path === 'string' ? route.path : request.path;
}

function getUser(request: RequestWithTrace): StructuredLogUser | undefined {
  if (typeof request.user?.id !== 'string') {
    return undefined;
  }

  return {
    id: request.user.id,
    ...(typeof request.user.role === 'string'
      ? { role: request.user.role }
      : {}),
  };
}

function toStructuredTrace(trace: RequestTraceContext): StructuredTraceContext {
  return {
    traceId: trace.traceId,
    spanId: trace.spanId,
    correlationId: trace.correlationId,
  };
}

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger: StructuredLogger;

  constructor(service: string | StructuredLogger) {
    this.logger =
      typeof service === 'string' ? new StructuredLogger(service) : service;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithTrace>();
    const response = context.switchToHttp().getResponse<Response>();
    const trace = getOrCreateTraceContext(request);
    const structuredTrace = toStructuredTrace(trace);
    const route = getRoute(request);
    const user = getUser(request);
    const startedAt = Date.now();

    setTraceResponseHeaders(response, trace);
    this.logger.log({
      message: 'Incoming HTTP request',
      trace: structuredTrace,
      ...(user ? { user } : {}),
      context: {
        action: 'HTTP_REQUEST_RECEIVED',
        method: request.method,
        path: route,
        ...(getResourceId(request)
          ? { resource_id: getResourceId(request) }
          : {}),
      },
    });

    return next.handle().pipe(
      tap(() => {
        this.logger.log({
          message: 'HTTP request completed',
          trace: structuredTrace,
          ...(user ? { user } : {}),
          context: {
            action: 'HTTP_REQUEST_COMPLETED',
            method: request.method,
            path: route,
            http_status: response.statusCode,
            ...(getResourceId(request)
              ? { resource_id: getResourceId(request) }
              : {}),
          },
          details: {
            duration_ms: Date.now() - startedAt,
          },
        });
      }),
    );
  }
}

@Catch()
export class HttpLoggingExceptionFilter implements ExceptionFilter {
  private readonly logger: StructuredLogger;

  constructor(service: string | StructuredLogger) {
    this.logger =
      typeof service === 'string' ? new StructuredLogger(service) : service;
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithTrace>();
    const response = context.getResponse<Response>();
    const trace = getOrCreateTraceContext(request);
    const status = this.getStatus(exception);
    const resourceId = getResourceId(request);

    setTraceResponseHeaders(response, trace);
    this.logger.error({
      message: 'HTTP request failed',
      trace: toStructuredTrace(trace),
      ...(getUser(request) ? { user: getUser(request) } : {}),
      context: {
        action: 'HTTP_REQUEST_FAILED',
        method: request.method,
        path: getRoute(request),
        http_status: status,
        ...(resourceId ? { resource_id: resourceId } : {}),
      },
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
