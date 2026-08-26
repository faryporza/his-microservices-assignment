import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import { AccessAuditInterceptor } from './access-audit.interceptor';
import { AuditOutcome } from './entities/audit-log.entity';
import { AuditService } from './audit.service';

describe('AccessAuditInterceptor', () => {
  const request = {
    method: 'GET',
    ip: '127.0.0.1',
    params: { id: 'record-1' },
    user: { id: 'user-1', role: 'DOCTOR' },
  };
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue('medical_record'),
  } as unknown as jest.Mocked<Reflector>;
  const auditService = {
    logAccess: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditService>;
  const interceptor = new AccessAuditInterceptor(reflector, auditService);

  beforeEach(() => {
    jest.clearAllMocks();
    reflector.getAllAndOverride.mockReturnValue('medical_record');
    auditService.logAccess.mockResolvedValue(undefined);
  });

  it('queues a granted audit event after a successful handler', async () => {
    const handler: CallHandler = { handle: () => of({ ok: true }) };

    await expect(
      lastValueFrom(interceptor.intercept(context, handler)),
    ).resolves.toEqual({ ok: true });
    expect(auditService.logAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-1',
        action: 'GET_medical_record',
        resourceId: 'record-1',
        outcome: AuditOutcome.GRANTED,
      }),
    );
  });

  it('queues a denied audit event when the handler rejects', async () => {
    const error = new Error('forbidden');
    const handler: CallHandler = {
      handle: () => throwError(() => error),
    };

    await expect(
      lastValueFrom(interceptor.intercept(context, handler)),
    ).rejects.toBe(error);
    expect(auditService.logAccess).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: AuditOutcome.DENIED }),
    );
  });

  it('does not audit requests without a resource or authenticated actor', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(undefined);
    const handler: CallHandler = { handle: () => of('ok') };

    await expect(
      lastValueFrom(interceptor.intercept(context, handler)),
    ).resolves.toBe('ok');
    expect(auditService.logAccess).not.toHaveBeenCalled();
  });
});
