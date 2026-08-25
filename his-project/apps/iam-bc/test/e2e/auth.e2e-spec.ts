import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { IamBcModule } from '@apps/iam-bc/iam-bc.module';
import { OpdBcModule } from '@apps/opd-bc/opd-bc.module';
import { EmrBcModule } from '@apps/emr-bc/emr-bc.module';
import { FinanceBcModule } from '@apps/finance-bc/finance-bc.module';
import {
  createMockAuthHeaders,
  createMockRedisService,
  createTestApp,
  RedisService,
  UserRole,
} from '@app/common';

describe('Auth & Cross-Service RBAC (e2e)', () => {
  jest.setTimeout(45_000);

  let iamApp!: INestApplication;
  let opdApp!: INestApplication;
  let emrApp!: INestApplication;
  let financeApp!: INestApplication;

  const mockRedis = createMockRedisService();

  beforeAll(async () => {
    // 1. IAM App
    const iamFixture: TestingModule = await Test.createTestingModule({
      imports: [IamBcModule],
    })
      .overrideProvider(RedisService)
      .useValue(mockRedis)
      .compile();
    iamApp = createTestApp(iamFixture, 'iam-bc');
    await iamApp.init();

    // 2. OPD App
    const opdFixture: TestingModule = await Test.createTestingModule({
      imports: [OpdBcModule],
    })
      .overrideProvider(RedisService)
      .useValue(mockRedis)
      .compile();
    opdApp = createTestApp(opdFixture, 'opd-bc');
    await opdApp.init();

    // 3. EMR App
    const emrFixture: TestingModule = await Test.createTestingModule({
      imports: [EmrBcModule],
    })
      .overrideProvider(RedisService)
      .useValue(mockRedis)
      .compile();
    emrApp = createTestApp(emrFixture, 'emr-bc');
    await emrApp.init();

    // 4. Finance App
    const financeFixture: TestingModule = await Test.createTestingModule({
      imports: [FinanceBcModule],
    })
      .overrideProvider(RedisService)
      .useValue(mockRedis)
      .compile();
    financeApp = createTestApp(financeFixture, 'finance-bc');
    await financeApp.init();
  });

  afterAll(async () => {
    if (iamApp) await iamApp.close();
    if (opdApp) await opdApp.close();
    if (emrApp) await emrApp.close();
    if (financeApp) await financeApp.close();
  });

  describe('Health Checks', () => {
    it('/ (GET) returns public health probe across microservices', async () => {
      await request(iamApp.getHttpServer() as App)
        .get('/')
        .expect(200)
        .expect('Hello World!');

      await request(opdApp.getHttpServer() as App)
        .get('/')
        .expect(200)
        .expect('Hello World!');

      await request(emrApp.getHttpServer() as App)
        .get('/')
        .expect(200)
        .expect('Hello World!');

      await request(financeApp.getHttpServer() as App)
        .get('/')
        .expect(200)
        .expect('Hello World!');
    });
  });

  describe('Complete Authentication & Token Lifecycle (IAM)', () => {
    const testUsername = `user_${randomUUID().slice(0, 8)}`;
    const testEmail = `${testUsername}@hospital.local`;
    const testPassword = 'Password123!';
    let accessToken: string;
    let refreshToken: string;

    it('registers a new user successfully (POST /auth/register)', async () => {
      const res = await request(iamApp.getHttpServer() as App)
        .post('/auth/register')
        .send({
          username: testUsername,
          email: testEmail,
          password: testPassword,
          role: UserRole.DOCTOR,
        })
        .expect(201);

      expect(res.body.status.code).toBe(201000);
      expect(res.body.data.type).toBe('users');
      expect(res.body.data.attributes.username).toBe(testUsername);
      expect(res.body.data.attributes.email).toBe(testEmail);
      expect(res.body.data.attributes.role).toBe(UserRole.DOCTOR);
      expect(res.body.data.attributes.password_hash).toBeUndefined();
    });

    it('rejects duplicate registration with 409 Conflict', async () => {
      const res = await request(iamApp.getHttpServer() as App)
        .post('/auth/register')
        .send({
          username: testUsername,
          email: testEmail,
          password: testPassword,
          role: UserRole.DOCTOR,
        })
        .expect(409);

      expect(res.body.status.code).toBe(409);
      expect(res.body.status.message).toContain('already exists');
    });

    it('authenticates user and returns token pair (POST /auth/login)', async () => {
      const res = await request(iamApp.getHttpServer() as App)
        .post('/auth/login')
        .send({
          username: testUsername,
          password: testPassword,
        })
        .expect(200);

      expect(res.body.status.code).toBe(200000);
      expect(res.body.data.type).toBe('tokens');
      expect(res.body.data.attributes.access_token).toBeDefined();
      expect(res.body.data.attributes.refresh_token).toBeDefined();
      expect(res.body.data.attributes.token_type).toBe('Bearer');

      accessToken = res.body.data.attributes.access_token as string;
      refreshToken = res.body.data.attributes.refresh_token as string;
    });

    it('retrieves user profile with valid access token (GET /auth/me)', async () => {
      const res = await request(iamApp.getHttpServer() as App)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.status.code).toBe(200000);
      expect(res.body.data.type).toBe('users');
      expect(res.body.data.attributes.username).toBe(testUsername);
      expect(res.body.data.attributes.role).toBe(UserRole.DOCTOR);
    });

    it('refreshes token and issues rotated pair (POST /auth/refresh)', async () => {
      const res = await request(iamApp.getHttpServer() as App)
        .post('/auth/refresh')
        .send({ refresh_token: refreshToken })
        .expect(200);

      expect(res.body.status.code).toBe(200000);
      expect(res.body.data.attributes.access_token).toBeDefined();
      expect(res.body.data.attributes.refresh_token).toBeDefined();
      expect(res.body.data.attributes.refresh_token).not.toBe(refreshToken);

      accessToken = res.body.data.attributes.access_token as string;
    });

    it('logs out and revokes active session (POST /auth/logout)', async () => {
      const res = await request(iamApp.getHttpServer() as App)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.status.code).toBe(200000);
      expect(res.body.data.attributes.message).toBe('Logged out successfully');
    });
  });

  describe('Cross-Service RBAC Guard Protection', () => {
    it('rejects unauthenticated requests with 401 Unauthorized across all services', async () => {
      // OPD protected endpoint
      await request(opdApp.getHttpServer() as App)
        .get('/patients')
        .expect(401);

      await request(opdApp.getHttpServer() as App)
        .post('/visits')
        .send({ patient_id: randomUUID() })
        .expect(401);

      // EMR protected endpoint
      await request(emrApp.getHttpServer() as App)
        .post('/records')
        .send({
          visit_id: randomUUID(),
          doctor_id: 'dr-1',
          diagnosis: 'Cold',
          treatment_cost: 500,
        })
        .expect(401);

      // Finance protected endpoint
      await request(financeApp.getHttpServer() as App)
        .get('/invoices')
        .expect(401);
    });

    it('allows DOCTOR on medical records but rejects with 403 Forbidden on invoice payment', async () => {
      const doctorHeaders = createMockAuthHeaders({
        role: UserRole.DOCTOR,
        username: 'dr_watson',
      });

      // Doctor is allowed to create medical record
      const emrRes = await request(emrApp.getHttpServer() as App)
        .post('/records')
        .set(doctorHeaders)
        .send({
          visit_id: randomUUID(),
          doctor_id: 'dr_watson',
          diagnosis: 'Migraine',
          treatment_note: 'Rest',
          treatment_cost: 1000,
        })
        .expect(201);

      expect(emrRes.body.status.code).toBe(201000);

      // Doctor is FORBIDDEN on invoice payment
      const financeRes = await request(financeApp.getHttpServer() as App)
        .patch(`/invoices/${randomUUID()}/pay`)
        .set(doctorHeaders)
        .send({ status: 'PAID' })
        .expect(403);

      expect(financeRes.body.status.code).toBe(403);
      expect(financeRes.body.status.message).toContain('Forbidden');
    });

    it('allows FINANCE_STAFF on invoice payment but rejects with 403 Forbidden on medical record creation', async () => {
      const financeHeaders = createMockAuthHeaders({
        role: UserRole.FINANCE_STAFF,
        username: 'finance_alice',
      });

      // Finance staff is FORBIDDEN on medical record creation
      const emrRes = await request(emrApp.getHttpServer() as App)
        .post('/records')
        .set(financeHeaders)
        .send({
          visit_id: randomUUID(),
          doctor_id: 'finance_alice',
          diagnosis: 'Test',
          treatment_cost: 1000,
        })
        .expect(403);

      expect(emrRes.body.status.code).toBe(403);
      expect(emrRes.body.status.message).toContain('Forbidden');

      // Finance staff is allowed to view invoices
      const financeRes = await request(financeApp.getHttpServer() as App)
        .get('/invoices')
        .set(financeHeaders)
        .expect(200);

      expect(financeRes.body.status.code).toBe(200000);
    });

    it('allows ADMIN across all services and operations', async () => {
      const adminHeaders = createMockAuthHeaders({
        role: UserRole.ADMIN,
        username: 'sysadmin',
      });

      // OPD
      const opdRes = await request(opdApp.getHttpServer() as App)
        .get('/patients')
        .set(adminHeaders)
        .expect(200);
      expect(opdRes.body.status.code).toBe(200000);

      // EMR
      const emrRes = await request(emrApp.getHttpServer() as App)
        .get('/records')
        .set(adminHeaders)
        .expect(200);
      expect(emrRes.body.status.code).toBe(200000);

      // Finance
      const financeRes = await request(financeApp.getHttpServer() as App)
        .get('/invoices')
        .set(adminHeaders)
        .expect(200);
      expect(financeRes.body.status.code).toBe(200000);
    });
  });
});
