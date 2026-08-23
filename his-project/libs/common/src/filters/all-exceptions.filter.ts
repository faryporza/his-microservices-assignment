import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  isInfrastructureError,
  StructuredLogger,
} from '../logging/structured.logger';
import {
  getOrCreateTraceContext,
  getResourceId,
  getRoute,
  getUser,
  RequestWithTrace,
  setTraceResponseHeaders,
  toStructuredTrace,
} from '../logging/http.logging';
import { ValidationException } from '../exceptions/validation.exception';
import { InvalidParameterException } from '../exceptions/invalid-parameter.exception';
import { ApiErrorObject, ApiErrorResponse } from '../response/response.types';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
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

    const errorResponse = this.buildErrorResponse(exception, status, request);
    response.status(status).json(errorResponse);
  }

  private getStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    return isInfrastructureError(exception)
      ? Number(HttpStatus.SERVICE_UNAVAILABLE)
      : Number(HttpStatus.INTERNAL_SERVER_ERROR);
  }

  private buildErrorResponse(
    exception: unknown,
    status: number,
    request: Request,
  ): ApiErrorResponse {
    let businessCode = status * 1000;
    let message = this.getDefaultStatusMessage(status);
    let errors: ApiErrorObject[] = [];

    if (exception instanceof ValidationException) {
      businessCode = exception.businessCode;
      message = exception.message || 'Validation Failed';
      errors = exception.errors;
    } else if (exception instanceof InvalidParameterException) {
      businessCode = exception.businessCode;
      message = exception.message || 'Invalid Parameter';
      errors = exception.errors;
    } else if (exception instanceof HttpException) {
      const httpResponse = exception.getResponse();
      if (typeof httpResponse === 'string') {
        errors = [
          {
            code: String(businessCode),
            title: exception.name || 'Error',
            detail: httpResponse,
          },
        ];
      } else if (typeof httpResponse === 'object' && httpResponse !== null) {
        const respObj = httpResponse as Record<string, unknown>;
        const title =
          (typeof respObj.error === 'string' && respObj.error) ||
          exception.name ||
          'Error';
        const msg = respObj.message;

        if (Array.isArray(msg)) {
          errors = msg.map((item) => ({
            code: String(businessCode),
            title,
            detail: String(item),
          }));
        } else if (typeof msg === 'string') {
          errors = [
            {
              code: String(businessCode),
              title,
              detail: msg,
            },
          ];
        } else {
          errors = [
            {
              code: String(businessCode),
              title,
              detail: exception.message,
            },
          ];
        }
      } else {
        errors = [
          {
            code: String(businessCode),
            title: exception.name || 'Error',
            detail: exception.message,
          },
        ];
      }
    } else {
      errors = [
        {
          code: String(businessCode),
          title: 'Internal Server Error',
          detail:
            status === Number(HttpStatus.SERVICE_UNAVAILABLE)
              ? 'Service unavailable'
              : 'Internal server error',
        },
      ];
    }

    return {
      status: {
        code: businessCode,
        message,
      },
      errors,
      meta: {
        timestamp: new Date().toISOString(),
      },
      links: {
        self: request.originalUrl || request.url,
      },
    };
  }

  private getDefaultStatusMessage(status: number): string {
    switch (status) {
      case Number(HttpStatus.BAD_REQUEST):
        return 'Bad Request';
      case Number(HttpStatus.UNAUTHORIZED):
        return 'Unauthorized';
      case Number(HttpStatus.FORBIDDEN):
        return 'Forbidden';
      case Number(HttpStatus.NOT_FOUND):
        return 'Resource Not Found';
      case Number(HttpStatus.CONFLICT):
        return 'Conflict';
      case Number(HttpStatus.UNPROCESSABLE_ENTITY):
        return 'Unprocessable Entity';
      case Number(HttpStatus.SERVICE_UNAVAILABLE):
        return 'Service unavailable';
      default:
        return status >= 500 ? 'Internal server error' : 'Request Failed';
    }
  }
}
