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

    app = createTestApp(moduleFixture, 'opd-bc');
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

  it('rejects missing and non-whitelisted patient fields with Blueprint validation format', async () => {
    const missingRes = await request(app.getHttpServer() as App)
      .post('/patients')
      .send({ first_name: 'Ada', last_name: 'Lovelace', id_card: 'ID-1' })
      .expect(400);

    expect(missingRes.body.status.code).toBe(400001);
    expect(missingRes.body.status.message).toBe('Validation Failed');
    expect(missingRes.body.errors.length).toBeGreaterThan(0);
    expect(
      missingRes.body.errors.some(
        (e: { source?: { pointer?: string } }) =>
          e.source?.pointer === '/data/attributes/hn',
      ),
    ).toBe(true);

    const camelCaseRes = await request(app.getHttpServer() as App)
      .post('/patients')
      .send({
        hn: 'HN-CAMEL-CASE',
        firstName: 'Ada',
        lastName: 'Lovelace',
        idCard: 'ID-CAMEL-CASE',
      })
      .expect(400);

    expect(camelCaseRes.body.status.code).toBe(400001);

    const nonWhitelistedRes = await request(app.getHttpServer() as App)
      .post('/patients')
      .send({
        hn: 'HN-STRICT',
        first_name: 'Ada',
        last_name: 'Lovelace',
        id_card: 'ID-STRICT',
        role: 'ADMIN',
      })
      .expect(400);

    expect(nonWhitelistedRes.body.status.code).toBe(400001);
  });

  it('validates visit and update-patient DTOs', async () => {
    const invalidVisit = await request(app.getHttpServer() as App)
      .post('/visits')
      .send({ patient_id: 'not-a-uuid' })
      .expect(400);

    expect(invalidVisit.body.status.code).toBe(400001);

    const invalidUpdate = await request(app.getHttpServer() as App)
      .patch(`/patients/${randomUUID()}`)
      .send({ unknownField: true })
      .expect(400);

    expect(invalidUpdate.body.status.code).toBe(400001);

    const notFoundUpdate = await request(app.getHttpServer() as App)
      .patch(`/patients/${randomUUID()}`)
      .send({ first_name: 'Grace' })
      .expect(404);

    expect(notFoundUpdate.body.status.code).toBe(404);
    expect(notFoundUpdate.body.status.message).toBe('Resource Not Found');

    const notFoundDelete = await request(app.getHttpServer() as App)
      .delete(`/patients/${randomUUID()}`)
      .expect(404);

    expect(notFoundDelete.body.status.code).toBe(404);
  });

  it('completes patient and visit CRUD with persisted state and Blueprint JSON:API format', async () => {
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

    expect(patient.body.status.code).toBe(201000);
    expect(patient.body.status.message).toBe('Request Succeeded');
    expect(patient.body.data.type).toBe('patients');
    expect(patient.body.data.attributes.hn).toBe(`HN-E2E-${suffix}`);
    expect(patient.body.data.attributes.first_name).toBe('Ada');
    expect(patient.body.links.self).toBe('/patients');
    const patientId = patient.body.data.id as string;

    const visit = await request(app.getHttpServer() as App)
      .post('/visits')
      .send({ patient_id: patientId })
      .expect(201);

    expect(visit.body.status.code).toBe(201000);
    expect(visit.body.data.type).toBe('visits');
    expect(visit.body.data.attributes.patient_id).toBe(patientId);
    expect(visit.body.data.attributes.status).toBe('OPEN');

    await request(app.getHttpServer() as App)
      .patch(`/patients/${patientId}`)
      .send({ first_name: 'Augusta' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status.code).toBe(200000);
        expect(body.data.type).toBe('patients');
        expect(body.data.id).toBe(patientId);
        expect(body.data.attributes.first_name).toBe('Augusta');
      });

    await request(app.getHttpServer() as App)
      .get(`/patients/${patientId}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.status.code).toBe(200000);
        expect(body.data.type).toBe('patients');
        expect(body.data.id).toBe(patientId);
        expect(body.data.attributes.last_name).toBe('Lovelace');
      });

    await request(app.getHttpServer() as App)
      .delete(`/patients/${patientId}`)
      .expect(204);
  });
});
