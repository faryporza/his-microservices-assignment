import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { IamBcModule } from '@apps/iam-bc/iam-bc.module';
import {
  createTestApp,
  RedisService,
  SessionMetadata,
  UserRole,
} from '@app/common';

describe('Auth & IAM Service (e2e)', () => {
  jest.setTimeout(45_000);

  let iamApp!: INestApplication;

  const sessions = new Map<string, SessionMetadata>();
  const blacklistedTokens = new Set<string>();

  const mockRedis = {
    createSession: jest
      .fn()
      .mockImplementation(
        (userId: string, sessionId: string, meta: SessionMetadata) => {
          sessions.set(`${userId}:${sessionId}`, meta);
          return Promise.resolve();
        },
      ),
    getSession: jest
      .fn()
      .mockImplementation((userId: string, sessionId: string) => {
        return Promise.resolve(sessions.get(`${userId}:${sessionId}`) ?? null);
      }),
    updateSessionRefreshToken: jest
      .fn()
      .mockImplementation(
        (userId: string, sessionId: string, newRefreshTokenJti: string) => {
          const existing = sessions.get(`${userId}:${sessionId}`);
          if (existing) {
            sessions.set(`${userId}:${sessionId}`, {
              ...existing,
              refreshTokenJti: newRefreshTokenJti,
            });
          }
          return Promise.resolve();
        },
      ),
    revokeSession: jest
      .fn()
      .mockImplementation((userId: string, sessionId: string) => {
        sessions.delete(`${userId}:${sessionId}`);
        return Promise.resolve();
      }),
    revokeAllUserSessions: jest.fn().mockImplementation((userId: string) => {
      for (const key of Array.from(sessions.keys())) {
        if (key.startsWith(`${userId}:`)) {
          sessions.delete(key);
        }
      }
      return Promise.resolve();
    }),
    blacklistAccessToken: jest.fn().mockImplementation((jti: string) => {
      blacklistedTokens.add(jti);
      return Promise.resolve();
    }),
    isAccessTokenBlacklisted: jest.fn().mockImplementation((jti: string) => {
      return Promise.resolve(blacklistedTokens.has(jti));
    }),
    incrementRateLimitCounter: jest.fn().mockResolvedValue(1),
  };

  beforeAll(async () => {
    const iamFixture: TestingModule = await Test.createTestingModule({
      imports: [IamBcModule],
    })
      .overrideProvider(RedisService)
      .useValue(mockRedis)
      .compile();
    iamApp = createTestApp(iamFixture, 'iam-bc');
    await iamApp.init();
  });

  afterAll(async () => {
    if (iamApp) await iamApp.close();
  });

  describe('Health Checks', () => {
    it('/ (GET) returns public health probe', async () => {
      await request(iamApp.getHttpServer() as App)
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

    it('registers a new user as patient (POST /auth/register)', async () => {
      const res = await request(iamApp.getHttpServer() as App)
        .post('/auth/register')
        .send({
          username: testUsername,
          email: testEmail,
          password: testPassword,
          first_name: 'John',
          last_name: 'Watson',
        })
        .expect(201);

      expect(res.body.status.code).toBe(201000);
      expect(res.body.data.type).toBe('users');
      expect(res.body.data.attributes.username).toBe(testUsername);
      expect(res.body.data.attributes.email).toBe(testEmail);
      expect(res.body.data.attributes.role).toBe(UserRole.PATIENT);
      expect(res.body.data.attributes.password_hash).toBeUndefined();
    });

    it('rejects duplicate registration with 409 Conflict', async () => {
      const res = await request(iamApp.getHttpServer() as App)
        .post('/auth/register')
        .send({
          username: testUsername,
          email: testEmail,
          password: testPassword,
          first_name: 'John',
          last_name: 'Watson',
        })
        .expect(409);

      expect(res.body.status.code).toBe(409);
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
      expect(res.body.data.attributes.role).toBe(UserRole.PATIENT);
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

      // Verify revoked token fails on subsequent requests
      await request(iamApp.getHttpServer() as App)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });
  });
});
