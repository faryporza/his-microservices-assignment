import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { FinanceBcModule } from '@apps/finance-bc/finance-bc.module';
import { App } from 'supertest/types';
import {
  createMockAuthHeaders,
  createMockRedisService,
  createTestApp,
  RedisService,
  UserRole,
} from '@app/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import {
  Invoice,
  InvoiceStatus,
} from '@apps/finance-bc/modules/invoice/entities/invoice.entity';

describe('HealthChecksController (Finance e2e)', () => {
  jest.setTimeout(30_000);
  let app!: INestApplication;
  const financeHeaders = createMockAuthHeaders({
    role: UserRole.FINANCE_STAFF,
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [FinanceBcModule],
    })
      .overrideProvider(RedisService)
      .useValue(createMockRedisService())
      .compile();

    app = createTestApp(moduleFixture, 'finance-bc');
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer() as App)
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('rejects non-whitelisted and invalid PayInvoiceDTO fields', async () => {
    const invoiceId = randomUUID();

    const invalidDate = await request(app.getHttpServer() as App)
      .patch(`/invoices/${invoiceId}/pay`)
      .set(financeHeaders)
      .send({ paid_at: new Date().toISOString() })
      .expect(400);

    expect(invalidDate.body.status.code).toBe(400001);
    expect(invalidDate.body.status.message).toBe('Validation Failed');
    expect(invalidDate.body.errors.length).toBeGreaterThan(0);

    const invalidStatus = await request(app.getHttpServer() as App)
      .patch(`/invoices/${invoiceId}/pay`)
      .set(financeHeaders)
      .send({ status: 'PENDING' })
      .expect(400);

    expect(invalidStatus.body.status.code).toBe(400001);

    const notFound = await request(app.getHttpServer() as App)
      .patch(`/invoices/${invoiceId}/pay`)
      .set(financeHeaders)
      .send({})
      .expect(404);

    expect(notFound.body.status.code).toBe(404);
    expect(notFound.body.status.message).toBe('Resource Not Found');
  });

  it('reads and pays a persisted invoice with Blueprint JSON:API format', async () => {
    const visitId = randomUUID();
    const repository = app.get(DataSource).getRepository(Invoice);
    const invoice = await repository.save(
      repository.create({
        visit_id: visitId,
        record_id: randomUUID(),
        total_amount: '1500.00',
        status: InvoiceStatus.PENDING,
        correlation_id: 'e2e-correlation-id',
        paid_at: null,
      }),
    );

    await request(app.getHttpServer() as App)
      .get(`/invoices/${visitId}`)
      .set(financeHeaders)
      .expect(200)
      .expect(({ body }) => {
        expect(body.status.code).toBe(200000);
        expect(Array.isArray(body.data)).toBe(true);
        expect(body.data[0].type).toBe('invoices');
        expect(body.data[0].id).toBe(invoice.id);
        expect(body.data[0].attributes.status).toBe('PENDING');
      });

    await request(app.getHttpServer() as App)
      .patch(`/invoices/${invoice.id}/pay`)
      .set(financeHeaders)
      .send({ status: 'PAID' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status.code).toBe(200000);
        expect(body.data.type).toBe('invoices');
        expect(body.data.id).toBe(invoice.id);
        expect(body.data.attributes.status).toBe('PAID');
        expect(body.data.attributes.paid_at).not.toBeNull();
      });
  });
});
