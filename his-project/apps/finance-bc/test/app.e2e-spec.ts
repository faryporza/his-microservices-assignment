import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { FinanceBcModule } from './../src/finance-bc.module';
import { App } from 'supertest/types';
import { createStrictValidationPipe } from '@app/common';
import { randomUUID } from 'node:crypto';

describe('FinanceBcController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [FinanceBcModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(createStrictValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer() as App)
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('rejects non-whitelisted and invalid PayInvoiceDto fields', async () => {
    const invoiceId = randomUUID();

    await request(app.getHttpServer() as App)
      .patch(`/invoices/${invoiceId}/pay`)
      .send({ paidAt: new Date().toISOString() })
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
});
