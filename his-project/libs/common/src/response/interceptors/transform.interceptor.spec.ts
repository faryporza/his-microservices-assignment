import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';
import { ApiCollectionResponse, ApiSingleResponse } from '../response.types';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    interceptor = new TransformInterceptor(reflector);
  });

  function createMockContext(
    resourceType?: string,
    statusCode: number = HttpStatus.OK,
    url = '/patients',
  ): ExecutionContext {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(resourceType);

    const request = {
      url,
      originalUrl: url,
      method: 'GET',
    };
    const response = {
      statusCode,
    };

    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
  }

  it('passes through raw data when no @ResourceType is present', async () => {
    const context = createMockContext(undefined);
    const next = { handle: () => of('Hello World!') };

    const result = await lastValueFrom(interceptor.intercept(context, next));
    expect(result).toBe('Hello World!');
  });

  it('passes through 204 No Content responses without wrapping', async () => {
    const context = createMockContext('patients', HttpStatus.NO_CONTENT);
    const next = { handle: () => of(undefined) };

    const result = await lastValueFrom(interceptor.intercept(context, next));
    expect(result).toBeUndefined();
  });

  it('wraps a single resource extracting id and putting remaining fields into attributes', async () => {
    const context = createMockContext(
      'patients',
      HttpStatus.OK,
      '/patients/123',
    );
    const entity = {
      id: '123',
      hn: 'HN-001',
      first_name: 'Ada',
      last_name: 'Lovelace',
    };
    const next = { handle: () => of(entity) };

    const result = (await lastValueFrom(
      interceptor.intercept(context, next),
    )) as ApiSingleResponse<typeof entity>;

    expect(result).toMatchObject({
      status: {
        code: 200000,
        message: 'Request Succeeded',
      },
      data: {
        type: 'patients',
        id: '123',
        attributes: {
          hn: 'HN-001',
          first_name: 'Ada',
          last_name: 'Lovelace',
        },
      },
      meta: {
        timestamp: expect.any(String),
      },
      links: {
        self: '/patients/123',
      },
    });
    expect(
      (result.data.attributes as Record<string, unknown>).id,
    ).toBeUndefined();
  });

  it('wraps a collection of resources', async () => {
    const context = createMockContext('patients', HttpStatus.OK, '/patients');
    const list = [
      { id: '1', hn: 'HN-001' },
      { id: '2', hn: 'HN-002' },
    ];
    const next = { handle: () => of(list) };

    const result = (await lastValueFrom(
      interceptor.intercept(context, next),
    )) as ApiCollectionResponse<unknown>;

    expect(result.status.code).toBe(200000);
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toEqual({
      type: 'patients',
      id: '1',
      attributes: { hn: 'HN-001' },
    });
    expect(result.data[1]).toEqual({
      type: 'patients',
      id: '2',
      attributes: { hn: 'HN-002' },
    });
  });

  it('uses 201000 status code for HTTP 201 Created responses', async () => {
    const context = createMockContext('visits', HttpStatus.CREATED, '/visits');
    const entity = { id: 'v-1', status: 'OPEN' };
    const next = { handle: () => of(entity) };

    const result = (await lastValueFrom(
      interceptor.intercept(context, next),
    )) as ApiSingleResponse<unknown>;

    expect(result.status.code).toBe(201000);
    expect(result.data.type).toBe('visits');
    expect(result.data.id).toBe('v-1');
    expect(result.data.attributes).toEqual({ status: 'OPEN' });
  });
});
