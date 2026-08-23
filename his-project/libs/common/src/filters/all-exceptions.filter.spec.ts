import { ArgumentsHost, HttpStatus, NotFoundException } from '@nestjs/common';
import { Request, Response } from 'express';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { ValidationException } from '../exceptions/validation.exception';
import { InvalidParameterException } from '../exceptions/invalid-parameter.exception';
import { StructuredLogger } from '../logging/structured.logger';
import { ApiErrorResponse } from '../response/response.types';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let logger: StructuredLogger;
  let response: Response;
  let request: Request;
  let host: ArgumentsHost;
  let responseJson: jest.Mock;
  let responseStatus: jest.Mock;
  let responseSetHeader: jest.Mock;

  beforeEach(() => {
    logger = new StructuredLogger('test-service');
    jest.spyOn(logger, 'error').mockImplementation();
    filter = new AllExceptionsFilter(logger);

    responseJson = jest.fn();
    responseStatus = jest.fn().mockReturnThis();
    responseSetHeader = jest.fn();

    response = {
      status: responseStatus,
      json: responseJson,
      setHeader: responseSetHeader,
    } as unknown as Response;

    request = {
      headers: {
        'x-correlation-id': 'corr-123',
        'x-trace-id': 'trace-123',
      },
      method: 'POST',
      url: '/patients',
      originalUrl: '/patients',
      path: '/patients',
      route: { path: '/patients' },
      params: {},
    } as unknown as Request;

    host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;
  });

  it('formats ValidationException with code 400001 and /data/attributes/ pointers', () => {
    const valException = new ValidationException([
      {
        code: '400001',
        title: 'Validation Error',
        detail: 'hn should not be empty',
        source: { pointer: '/data/attributes/hn' },
      },
    ]);

    filter.catch(valException, host);

    expect(responseStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const sentResponse = responseJson.mock.calls[0][0] as ApiErrorResponse;

    expect(sentResponse).toEqual({
      status: {
        code: 400001,
        message: 'Validation Failed',
      },
      errors: [
        {
          code: '400001',
          title: 'Validation Error',
          detail: 'hn should not be empty',
          source: { pointer: '/data/attributes/hn' },
        },
      ],
      meta: {
        timestamp: expect.any(String),
      },
      links: {
        self: '/patients',
      },
    });
    expect(
      (sentResponse as unknown as Record<string, unknown>).data,
    ).toBeUndefined();
  });

  it('formats InvalidParameterException with code 400002', () => {
    const invalidParam = new InvalidParameterException([
      {
        code: '400002',
        title: 'Invalid Parameter',
        detail: 'page must be a number',
        source: { parameter: 'page' },
      },
    ]);

    filter.catch(invalidParam, host);

    expect(responseStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const sentResponse = responseJson.mock.calls[0][0] as ApiErrorResponse;

    expect(sentResponse.status.code).toBe(400002);
    expect(sentResponse.errors[0].source?.parameter).toBe('page');
  });

  it('formats standard NotFoundException with code 404000', () => {
    const notFound = new NotFoundException("Patient with ID '123' not found");

    filter.catch(notFound, host);

    expect(responseStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    const sentResponse = responseJson.mock.calls[0][0] as ApiErrorResponse;

    expect(sentResponse).toEqual({
      status: {
        code: 404000,
        message: 'Resource Not Found',
      },
      errors: [
        {
          code: '404000',
          title: 'Not Found',
          detail: "Patient with ID '123' not found",
        },
      ],
      meta: {
        timestamp: expect.any(String),
      },
      links: {
        self: '/patients',
      },
    });
  });

  it('formats unhandled application exceptions as 500000', () => {
    const error = new Error('Unexpected logic failure');

    filter.catch(error, host);

    expect(responseStatus).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    const sentResponse = responseJson.mock.calls[0][0] as ApiErrorResponse;

    expect(sentResponse.status.code).toBe(500000);
    expect(sentResponse.status.message).toBe('Internal server error');
    expect(sentResponse.errors[0].title).toBe('Internal Server Error');
  });

  it('formats infrastructure exceptions as 503000', () => {
    const error = new Error('Database connection failed');

    filter.catch(error, host);

    expect(responseStatus).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    const sentResponse = responseJson.mock.calls[0][0] as ApiErrorResponse;

    expect(sentResponse.status.code).toBe(503000);
    expect(sentResponse.status.message).toBe('Service unavailable');
    expect(sentResponse.errors[0].title).toBe('Internal Server Error');
  });

  it('sets trace headers and emits structured error logs', () => {
    const error = new NotFoundException('Not found');

    filter.catch(error, host);

    expect(responseSetHeader).toHaveBeenCalledWith(
      'x-correlation-id',
      'corr-123',
    );
    expect(responseSetHeader).toHaveBeenCalledWith('x-trace-id', 'trace-123');
    expect(responseSetHeader).toHaveBeenCalledWith(
      'x-span-id',
      expect.any(String),
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'HTTP request failed',
        context: expect.objectContaining({
          action: 'HTTP_REQUEST_FAILED',
          http_status: 404,
        }),
      }),
    );
  });
});
