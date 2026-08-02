import { Logger } from '@nestjs/common';
import { StructuredLogger } from './structured-logger';

describe('StructuredLogger', () => {
  afterEach(() => jest.restoreAllMocks());

  it('writes the trace fields without serializing sensitive exception details', () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const logger = new StructuredLogger('opd-bc');

    logger.error({
      eventName: 'patient.create',
      eventId: 'event-id',
      correlationId: 'correlation-id',
      visitId: 'visit-id',
      status: 500,
      error: new Error('password=secret idCard=1234567890123'),
    });

    const payload = JSON.parse(log.mock.calls[0][0] as string) as Record<
      string,
      unknown
    >;
    expect(payload).toMatchObject({
      service: 'opd-bc',
      eventName: 'patient.create',
      eventId: 'event-id',
      correlationId: 'correlation-id',
      visitId: 'visit-id',
      status: 500,
      error: 'Error',
    });
    expect(JSON.stringify(payload)).not.toContain('secret');
    expect(JSON.stringify(payload)).not.toContain('1234567890123');
  });
});
