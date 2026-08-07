import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { EmrBcModule } from '@apps/emr-bc/emr-bc.module';
import { App } from 'supertest/types';
import { createStrictValidationPipe, createTestApp } from '@app/common';
import { randomUUID } from 'node:crypto';

describe('HealthChecksController (EMR e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [EmrBcModule],
    }).compile();

    app = createTestApp(moduleFixture);
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

  it('rejects invalid medical record fields', () => {
    return request(app.getHttpServer() as App)
      .post('/records')
      .send({
        visit_id: 'not-a-uuid',
        doctor_id: '',
        diagnosis: '',
        treatment_cost: -1,
        unexpected: true,
      })
      .expect(400);
  });

  it('validates the medical record update URI before business logic', async () => {
    await request(app.getHttpServer() as App)
      .patch(`/records/${randomUUID()}`)
      .send({ status: 'INVALID' })
      .expect(400);

    await request(app.getHttpServer() as App)
      .patch(`/records/${randomUUID()}`)
      .send({ unexpected: true })
      .expect(400);

    await request(app.getHttpServer() as App)
      .patch(`/records/${randomUUID()}`)
      .send({
        status: 'COMPLETED',
        diagnosis: 'Flu',
        treatment_cost: 100,
      })
      .expect(404);
  });

  it('creates, reads, and completes a medical record', async () => {
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

    const recordId = created.body.id as string;
    expect(created.body.status).toBe('WAITING');

    await request(app.getHttpServer() as App)
      .get(`/records/${recordId}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.visit_id).toBe(visitId);
      });

    await request(app.getHttpServer() as App)
      .patch(`/records/${recordId}`)
      .send({ status: 'COMPLETED', treatment_cost: 1750 })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('COMPLETED');
        expect(body.treatment_cost).toBe('1750');
      });
  });
});
