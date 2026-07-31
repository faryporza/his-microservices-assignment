import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { EmrBcModule } from './../src/emr-bc.module';
import { App } from 'supertest/types';
import { createStrictValidationPipe } from '@app/common';
import { randomUUID } from 'node:crypto';

describe('EmrBcController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [EmrBcModule],
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

  it('rejects invalid medical record fields', () => {
    return request(app.getHttpServer() as App)
      .post('/records')
      .send({
        visitId: 'not-a-uuid',
        doctorId: '',
        diagnosis: '',
        treatmentCost: -1,
        unexpected: true,
      })
      .expect(400);
  });

  it('validates CompleteTreatmentDto before business logic', async () => {
    await request(app.getHttpServer() as App)
      .patch(`/records/${randomUUID()}/complete`)
      .send({ diagnosis: 'Flu', treatmentCost: 100 })
      .expect(400);

    await request(app.getHttpServer() as App)
      .patch(`/records/${randomUUID()}/complete`)
      .send({
        doctorId: 'doctor-1',
        diagnosis: 'Flu',
        treatmentCost: 100,
        status: 'COMPLETED',
      })
      .expect(400);

    await request(app.getHttpServer() as App)
      .patch(`/records/${randomUUID()}/complete`)
      .send({
        doctorId: 'doctor-1',
        diagnosis: 'Flu',
        treatmentCost: 100,
      })
      .expect(404);
  });
});
