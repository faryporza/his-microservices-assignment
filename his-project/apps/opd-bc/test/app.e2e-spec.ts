import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { OpdBcModule } from './../src/opd-bc.module';
import { App } from 'supertest/types';
import { createStrictValidationPipe } from '@app/common';
import { randomUUID } from 'node:crypto';

describe('OpdBcController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [OpdBcModule],
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
});
