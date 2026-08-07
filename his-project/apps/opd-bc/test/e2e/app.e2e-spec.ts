import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { OpdBcModule } from '@apps/opd-bc/opd-bc.module';
import { App } from 'supertest/types';
import { createTestApp } from '@app/common';
import { randomUUID } from 'node:crypto';

describe('HealthChecksController (OPD e2e)', () => {
  jest.setTimeout(30_000);
  let app!: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [OpdBcModule],
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

  it('rejects missing and non-whitelisted patient fields', async () => {
    await request(app.getHttpServer() as App)
      .post('/patients')
      .send({ first_name: 'Ada', last_name: 'Lovelace', id_card: 'ID-1' })
      .expect(400);

    await request(app.getHttpServer() as App)
      .post('/patients')
      .send({
        hn: 'HN-CAMEL-CASE',
        firstName: 'Ada',
        lastName: 'Lovelace',
        idCard: 'ID-CAMEL-CASE',
      })
      .expect(400);

    await request(app.getHttpServer() as App)
      .post('/patients')
      .send({
        hn: 'HN-STRICT',
        first_name: 'Ada',
        last_name: 'Lovelace',
        id_card: 'ID-STRICT',
        role: 'ADMIN',
      })
      .expect(400);
  });

  it('validates visit and update-patient DTOs', async () => {
    await request(app.getHttpServer() as App)
      .post('/visits')
      .send({ patient_id: 'not-a-uuid' })
      .expect(400);

    await request(app.getHttpServer() as App)
      .patch(`/patients/${randomUUID()}`)
      .send({ unknownField: true })
      .expect(400);

    await request(app.getHttpServer() as App)
      .patch(`/patients/${randomUUID()}`)
      .send({ first_name: 'Grace' })
      .expect(404);

    await request(app.getHttpServer() as App)
      .delete(`/patients/${randomUUID()}`)
      .expect(404);
  });

  it('completes patient and visit CRUD with persisted state', async () => {
    const suffix = randomUUID().slice(0, 8);
    const patient = await request(app.getHttpServer() as App)
      .post('/patients')
      .send({
        hn: `HN-E2E-${suffix}`,
        first_name: 'Ada',
        last_name: 'Lovelace',
        id_card: `E2E-${suffix}`,
      })
      .expect(201);

    expect(patient.body.status).toBeUndefined();
    const patientId = patient.body.id as string;

    const visit = await request(app.getHttpServer() as App)
      .post('/visits')
      .send({ patient_id: patientId })
      .expect(201);
    expect(visit.body.status).toBe('OPEN');

    await request(app.getHttpServer() as App)
      .patch(`/patients/${patientId}`)
      .send({ first_name: 'Augusta' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.first_name).toBe('Augusta');
      });

    await request(app.getHttpServer() as App)
      .get(`/patients/${patientId}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.id).toBe(patientId);
      });

    await request(app.getHttpServer() as App)
      .delete(`/patients/${patientId}`)
      .expect(204);
  });
});
