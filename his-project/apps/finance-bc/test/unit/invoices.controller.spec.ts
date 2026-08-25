import { Reflector } from '@nestjs/core';
import { InvoicesController } from '@apps/finance-bc/modules/invoice/controllers/invoices.controller';
import { ROLES_KEY, UserRole } from '@app/common';
import {
  createMockInvoice,
  createMockInvoicesService,
} from '../mocks/mock-invoices';

describe('InvoicesController (Unit)', () => {
  const reflector = new Reflector();
  const service = createMockInvoicesService();
  const controller = new InvoicesController(service);
  const invoice = createMockInvoice();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates invoice queries', async () => {
    service.findAll.mockResolvedValue([invoice]);
    service.findByVisitId.mockResolvedValue([invoice]);

    await expect(controller.findAll()).resolves.toEqual([invoice]);
    await expect(controller.findByVisitId(invoice.visit_id)).resolves.toEqual([
      invoice,
    ]);

    expect(service.findAll).toHaveBeenCalledWith();
    expect(service.findByVisitId).toHaveBeenCalledWith(invoice.visit_id);
  });

  it('passes payment body and request tracing identifiers', async () => {
    service.pay.mockResolvedValue({ ...invoice, status: 'PAID' });

    await expect(
      controller.pay(
        invoice.id,
        { status: 'PAID' },
        'correlation-id',
        'trace-id',
      ),
    ).resolves.toMatchObject({ status: 'PAID' });
    expect(service.pay).toHaveBeenCalledWith(
      invoice.id,
      'correlation-id',
      'trace-id',
    );
  });

  it('verifies RBAC role metadata on all invoice endpoints', () => {
    const findAllRoles = reflector.get<UserRole[]>(
      ROLES_KEY,
      InvoicesController.prototype.findAll,
    );
    expect(findAllRoles).toEqual([UserRole.ADMIN, UserRole.FINANCE_STAFF]);

    const findByVisitIdRoles = reflector.get<UserRole[]>(
      ROLES_KEY,
      InvoicesController.prototype.findByVisitId,
    );
    expect(findByVisitIdRoles).toEqual([
      UserRole.ADMIN,
      UserRole.FINANCE_STAFF,
      UserRole.PATIENT,
    ]);

    const payRoles = reflector.get<UserRole[]>(
      ROLES_KEY,
      InvoicesController.prototype.pay,
    );
    expect(payRoles).toEqual([UserRole.ADMIN, UserRole.FINANCE_STAFF]);
  });
});
