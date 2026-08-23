import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { EmrBcModule } from '@apps/emr-bc/emr-bc.module';
import { App } from 'supertest/types';
import { createTestApp } from '@app/common';
import { randomUUID } from 'node:crypto';

describe('HealthChecksController (EMR e2e)', () => {
  jest.setTimeout(30_000);
  let app!: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [EmrBcModule],
    }).compile();

    app = createTestApp(moduleFixture, 'emr-bc');
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

  it('rejects invalid medical record fields', async () => {
    const res = await request(app.getHttpServer() as App)
      .post('/records')
      .send({
        visit_id: 'not-a-uuid',
        doctor_id: '',
        diagnosis: '',
        treatment_cost: -1,
        unexpected: true,
      })
      .expect(400);

    expect(res.body.status.code).toBe(400001);
    expect(res.body.status.message).toBe('Validation Failed');
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('validates the medical record update URI before business logic', async () => {
    const invalidStatus = await request(app.getHttpServer() as App)
      .patch(`/records/${randomUUID()}`)
      .send({ status: 'INVALID' })
      .expect(400);

    expect(invalidStatus.body.status.code).toBe(400001);

    const unexpectedField = await request(app.getHttpServer() as App)
      .patch(`/records/${randomUUID()}`)
      .send({ unexpected: true })
      .expect(400);

    expect(unexpectedField.body.status.code).toBe(400001);

    const notFound = await request(app.getHttpServer() as App)
      .patch(`/records/${randomUUID()}`)
      .send({
        status: 'COMPLETED',
        diagnosis: 'Flu',
        treatment_cost: 100,
      })
      .expect(404);

    expect(notFound.body.status.code).toBe(404);
    expect(notFound.body.status.message).toBe('Resource Not Found');
  });

  it('creates, reads, and completes a medical record with Blueprint JSON:API format', async () => {
    const visitId = randomUUID();
    const created = await request(app.getHttpServer() as App)
      .post('/records')
      .send({
        visit_id: visitId,
        doctor_id: 'doctor-e2e',
        diagnosis: 'Influenza',
        treatment_note: 'Rest and fluids',
        treatment_cost: 1500,
        status: 'WAITING',
      })
      .expect(201);

    expect(created.body.status.code).toBe(201000);
    expect(created.body.data.type).toBe('medical-records');
    expect(created.body.data.attributes.status).toBe('WAITING');
    expect(created.body.data.attributes.visit_id).toBe(visitId);
    const recordId = created.body.data.id as string;

    await request(app.getHttpServer() as App)
      .get(`/records/${recordId}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.status.code).toBe(200000);
        expect(body.data.type).toBe('medical-records');
        expect(body.data.id).toBe(recordId);
        expect(body.data.attributes.visit_id).toBe(visitId);
      });

    await request(app.getHttpServer() as App)
      .patch(`/records/${recordId}`)
      .send({ status: 'COMPLETED', treatment_cost: 1750 })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status.code).toBe(200000);
        expect(body.data.type).toBe('medical-records');
        expect(body.data.id).toBe(recordId);
        expect(body.data.attributes.status).toBe('COMPLETED');
        expect(Number(body.data.attributes.treatment_cost)).toBe(1750);
      });
  });
});
