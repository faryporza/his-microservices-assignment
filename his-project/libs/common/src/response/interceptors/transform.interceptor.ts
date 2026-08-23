import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RESOURCE_TYPE_KEY } from '../decorators/resource-type.decorator';
import {
  ApiCollectionResponse,
  ApiPaginatedResponse,
  ApiResourceObject,
  ApiSingleResponse,
  PaginationMeta,
} from '../response.types';

interface PaginatedPayload {
  data: unknown[];
  pagination: PaginationMeta;
}

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const resourceType = this.reflector.getAllAndOverride<string>(
      RESOURCE_TYPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!resourceType) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    return next.handle().pipe(
      map((data: unknown) => {
        if (response.statusCode === Number(HttpStatus.NO_CONTENT)) {
          return data;
        }

        const statusCode = response.statusCode || Number(HttpStatus.OK);
        const businessCode = statusCode * 1000;

        if (this.isPaginated(data)) {
          const transformedCollection = data.data.map((item) =>
            this.transformResource(item, resourceType),
          ) as ApiResourceObject<Record<string, unknown>>[];

          const result: ApiPaginatedResponse<Record<string, unknown>> = {
            status: {
              code: businessCode,
              message: 'Request Succeeded',
            },
            data: transformedCollection,
            meta: {
              timestamp: new Date().toISOString(),
              pagination: data.pagination,
            },
            links: {
              self: request.originalUrl || request.url,
            },
          };

          return result;
        }

        if (Array.isArray(data)) {
          const transformedCollection = data.map((item) =>
            this.transformResource(item, resourceType),
          ) as ApiResourceObject<Record<string, unknown>>[];

          const result: ApiCollectionResponse<Record<string, unknown>> = {
            status: {
              code: businessCode,
              message: 'Request Succeeded',
            },
            data: transformedCollection,
            meta: {
              timestamp: new Date().toISOString(),
            },
            links: {
              self: request.originalUrl || request.url,
            },
          };

          return result;
        }

        const transformedSingle = this.transformResource(
          data,
          resourceType,
        ) as ApiResourceObject<Record<string, unknown>>;

        const result: ApiSingleResponse<Record<string, unknown>> = {
          status: {
            code: businessCode,
            message: 'Request Succeeded',
          },
          data: transformedSingle,
          meta: {
            timestamp: new Date().toISOString(),
          },
          links: {
            self: request.originalUrl || request.url,
          },
        };

        return result;
      }),
    );
  }

  private isPaginated(data: unknown): data is PaginatedPayload {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const candidate = data as Record<string, unknown>;
    return (
      Array.isArray(candidate.data) &&
      typeof candidate.pagination === 'object' &&
      candidate.pagination !== null &&
      typeof (candidate.pagination as Record<string, unknown>).page ===
        'number' &&
      typeof (candidate.pagination as Record<string, unknown>).page_size ===
        'number'
    );
  }

  private transformResource(item: unknown, type: string): unknown {
    if (item === null || item === undefined || typeof item !== 'object') {
      return item;
    }

    const plain =
      typeof (item as { toJSON?: () => unknown }).toJSON === 'function'
        ? (item as { toJSON: () => Record<string, unknown> }).toJSON()
        : { ...(item as Record<string, unknown>) };

    const { id, ...attributes } = plain;
    const idString =
      typeof id === 'string'
        ? id
        : typeof id === 'number'
          ? String(id)
          : undefined;

    return {
      type,
      ...(idString !== undefined ? { id: idString } : {}),
      attributes,
    };
  }
}
