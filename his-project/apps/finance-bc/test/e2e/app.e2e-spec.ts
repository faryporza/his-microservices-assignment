import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { FinanceBcModule } from '@apps/finance-bc/finance-bc.module';
import { App } from 'supertest/types';
import { createTestApp } from '@app/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import {
  Invoice,
  InvoiceStatus,
} from '@apps/finance-bc/modules/invoice/entities/invoice.entity';

describe('HealthChecksController (Finance e2e)', () => {
  jest.setTimeout(30_000);
  let app!: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [FinanceBcModule],
    }).compile();

    app = createTestApp(moduleFixture);
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

    await request(app.getHttpServer() as App)
      .patch(`/invoices/${invoiceId}/pay`)
      .send({ paid_at: new Date().toISOString() })
      .expect(400);

    await request(app.getHttpServer() as App)
      .patch(`/invoices/${invoiceId}/pay`)
      .send({ status: 'PENDING' })
      .expect(400);

    await request(app.getHttpServer() as App)
      .patch(`/invoices/${invoiceId}/pay`)
      .send({})
      .expect(404);
  });

  it('reads and pays a persisted invoice', async () => {
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
      .expect(200)
      .expect(({ body }) => {
        expect(body[0].id).toBe(invoice.id);
        expect(body[0].status).toBe('PENDING');
      });

    await request(app.getHttpServer() as App)
      .patch(`/invoices/${invoice.id}/pay`)
      .send({ status: 'PAID' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('PAID');
        expect(body.paid_at).not.toBeNull();
      });
  });
});
