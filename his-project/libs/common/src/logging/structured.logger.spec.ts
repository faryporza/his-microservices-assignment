import { StructuredLogger } from './structured.logger';

describe('StructuredLogger', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalLogLevel = process.env.LOG_LEVEL;

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.NODE_ENV = originalNodeEnv;
    process.env.LOG_LEVEL = originalLogLevel;
  });

  it('writes one parseable JSON object with every required standard field', () => {
    const write = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    const logger = new StructuredLogger('opd-bc', '1.2.0');

    logger.log({
      message: 'Visit created successfully',
      trace: {
        traceId: 'trace-123',
        spanId: 'span-456',
        correlationId: 'request-789',
      },
      context: {
        action: 'CREATE_VISIT',
        visit_id: 'visit-id',
      },
    });

    const line = String(write.mock.calls[0][0]);
    const payload = JSON.parse(line) as Record<string, unknown>;
    expect(line.trimStart().startsWith('{')).toBe(true);
    expect(payload).toMatchObject({
      level: 'info',
      message: 'Visit created successfully',
      service: { name: 'opd-bc', version: '1.2.0' },
      trace: {
        trace_id: 'trace-123',
        span_id: 'span-456',
        correlation_id: 'request-789',
      },
      context: {
        action: 'CREATE_VISIT',
        visit_id: 'visit-id',
      },
    });
    expect(new Date(payload.timestamp as string).toISOString()).toBe(
      payload.timestamp,
    );
  });

  it('redacts sensitive fields and never serializes raw exception messages', () => {
    const write = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    const logger = new StructuredLogger('finance-bc', '1.2.0');

    logger.error({
      message: 'Payment failed password=secret-value',
      trace: {
        traceId: 'trace-id',
        correlationId: 'correlation-id',
      },
      context: {
        action: 'PAY_INVOICE',
        token: 'raw-token',
        id_card: '1234567890123',
      },
      details: {
        authorization: 'Bearer raw-token',
      },
      error: new Error('database password=driver-secret'),
    });

    const serialized = String(write.mock.calls[0][0]);
    const payload = JSON.parse(serialized) as {
      level: string;
      details: Record<string, unknown>;
    };
    expect(payload.level).toBe('error');
    expect(payload.details.error_type).toBe('InfrastructureUnavailable');
    expect(serialized).not.toContain('secret-value');
    expect(serialized).not.toContain('raw-token');
    expect(serialized).not.toContain('1234567890123');
    expect(serialized).not.toContain('driver-secret');
  });

  it('normalizes NestJS framework messages into the same JSON schema', () => {
    const write = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    const logger = new StructuredLogger('emr-bc', '1.2.0');

    logger.log('Starting Nest application', 'NestFactory');

    const payload = JSON.parse(String(write.mock.calls[0][0])) as {
      message: string;
      context: Record<string, unknown>;
      trace: Record<string, unknown>;
    };
    expect(payload.message).toBe('Starting Nest application');
    expect(payload.context).toEqual({
      source: 'nestjs',
      nest_context: 'NestFactory',
    });
    expect(payload.trace.trace_id).toEqual(expect.any(String));
    expect(payload.trace.correlation_id).toEqual(expect.any(String));
  });

  it('disables debug logs by default in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.LOG_LEVEL;
    const write = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    const logger = new StructuredLogger('opd-bc', '1.2.0');

    logger.debug({ message: 'Internal state', context: { action: 'DEBUG' } });
    logger.warn({
      message: 'Retrying operation',
      context: { action: 'RETRY' },
    });

    expect(write).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(write.mock.calls[0][0]))).toMatchObject({
      level: 'warn',
    });
  });

  it('supports explicit log levels, framework errors, and nested sanitization', () => {
    const stdout = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    const stderr = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    const logger = new StructuredLogger('opd-bc', '1.2.0');
    logger.setLogLevels(['error']);

    logger.debug({ message: 'hidden', context: {} });
    logger.log(new Error('database password=hidden'), 'NestFactory');
    logger.error({
      message: 'failed',
      trace: { traceId: ' '.repeat(129) },
      user: { id: 'user-1', role: 'doctor' },
      context: {
        nested: { token: 'hidden', values: ['1234567890123', 'safe'] },
      },
    });

    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(stderr.mock.calls[0][0])) as {
      user: Record<string, string>;
      context: Record<string, unknown>;
    };
    expect(payload.user).toEqual({ id: 'user-1', role: 'doctor' });
    expect(payload.context).toEqual({
      nested: { token: '[REDACTED]', values: ['[REDACTED_NUMBER]', 'safe'] },
    });
  });

  it('normalizes invalid levels and unknown values safely', () => {
    process.env.LOG_LEVEL = 'not-a-level';
    const write = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    const logger = new StructuredLogger('opd-bc', '1.2.0');

    logger.verbose({ message: { unexpected: true }, context: {} });
    logger.log(null);

    expect(write).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(write.mock.calls[0][0]))).toMatchObject({
      level: 'debug',
      message: 'Framework lifecycle event',
    });
  });
});
