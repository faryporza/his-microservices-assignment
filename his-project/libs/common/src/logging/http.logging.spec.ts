import {
  ArgumentsHost,
  BadRequestException,
  CallHandler,
  ExecutionContext,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { lastValueFrom, of } from 'rxjs';
import {
  getOrCreateTraceContext,
  HttpLoggingExceptionFilter,
  RequestLoggingInterceptor,
} from './http.logging';
import { StructuredLogger, StructuredLogInput } from './structured.logger';

describe('HTTP structured logging', () => {
  function createRequest(headers: Record<string, string> = {}): Request {
    return {
      headers,
      method: 'POST',
      path: '/visits',
      route: { path: '/visits' },
      params: {},
    } as unknown as Request;
  }

  it('preserves inbound trace headers and creates a service span', () => {
    const request = createRequest({
      'x-correlation-id': 'correlation-123',
      'x-trace-id': 'trace-456',
    });

    const trace = getOrCreateTraceContext(request);

    expect(trace).toMatchObject({
      correlationId: 'correlation-123',
      traceId: 'trace-456',
      spanId: expect.any(String),
    });
    expect(request.headers['x-span-id']).toBe(trace.spanId);
  });

  it('adds trace headers to the response and logs request lifecycle context', async () => {
    const request = createRequest();
    const response = {
      statusCode: 201,
      setHeader: jest.fn(),
    } as unknown as Response;
    const logger = {
      log: jest.fn(),
    } as unknown as StructuredLogger;
    const executionContext = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
    const next = { handle: () => of({ id: 'visit-id' }) } as CallHandler;

    await lastValueFrom(
      new RequestLoggingInterceptor(logger).intercept(executionContext, next),
    );

    expect(response.setHeader).toHaveBeenCalledWith(
      'x-correlation-id',
      expect.any(String),
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'x-trace-id',
      expect.any(String),
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'x-span-id',
      expect.any(String),
    );
    expect(logger.log).toHaveBeenCalledTimes(2);
    expect(logger.log).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        message: 'Incoming HTTP request',
        context: expect.objectContaining({
          action: 'HTTP_REQUEST_RECEIVED',
          method: 'POST',
          path: '/visits',
        }),
      }) as StructuredLogInput,
    );
    expect(logger.log).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        message: 'HTTP request completed',
        context: expect.objectContaining({
          action: 'HTTP_REQUEST_COMPLETED',
          http_status: 201,
        }),
      }) as StructuredLogInput,
    );
  });

  it('logs failures with the same trace returned to the client', () => {
    const request = createRequest();
    const response = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const logger = {
      error: jest.fn(),
    } as unknown as StructuredLogger;
    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;

    new HttpLoggingExceptionFilter(logger).catch(
      new BadRequestException('Invalid request'),
      host,
    );

    const trace = getOrCreateTraceContext(request);
    expect(response.setHeader).toHaveBeenCalledWith(
      'x-correlation-id',
      trace.correlationId,
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'HTTP request failed',
        trace: expect.objectContaining({
          traceId: trace.traceId,
          correlationId: trace.correlationId,
        }),
        context: expect.objectContaining({
          action: 'HTTP_REQUEST_FAILED',
          http_status: 400,
        }),
      }) as StructuredLogInput,
    );
    expect(response.status).toHaveBeenCalledWith(400);
  });
});
