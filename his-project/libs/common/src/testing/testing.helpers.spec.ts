import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import {
  createMockAuthHeaders,
  createMockJwtToken,
  createMockRedisService,
  createTestApp,
  createTestingModule,
} from './testing.helpers';
import { UserRole } from '../auth/constants/user-roles.enum';

describe('testing helpers', () => {
  it('creates a testing module and an app with strict validation', async () => {
    const module = await createTestingModule([], []).compile();
    const app = createTestApp(module);

    expect(app).toBeDefined();
    await app.close();
  });

  it('remains compatible with Nest testing modules', async () => {
    const module = await Test.createTestingModule({}).compile();
    expect(module).toBeDefined();
    await module.close();
  });

  it('generates a valid mock JWT token with defaults', () => {
    const token = createMockJwtToken();
    expect(typeof token).toBe('string');

    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(decoded.sub).toBe('mock-user-uuid-1');
    expect(decoded.role).toBe(UserRole.ADMIN);
    expect(decoded.username).toBe('mock_admin');
  });

  it('generates custom mock JWT token payload and headers', () => {
    const headers = createMockAuthHeaders({
      id: 'custom-doctor-id',
      username: 'dr_who',
      role: UserRole.DOCTOR,
    });

    expect(headers.authorization).toMatch(/^Bearer ey/);
    const token = headers.authorization.replace('Bearer ', '');
    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(decoded.sub).toBe('custom-doctor-id');
    expect(decoded.username).toBe('dr_who');
    expect(decoded.role).toBe(UserRole.DOCTOR);
  });

  it('creates mock Redis service with working default behaviors', async () => {
    const mockRedis = createMockRedisService();
    const session = await mockRedis.getSession!('user-1', 'session-1');

    expect(session?.userId).toBe('user-1');
    expect(session?.role).toBe(UserRole.ADMIN);
    expect(await mockRedis.isAccessTokenBlacklisted!('jti')).toBe(false);
  });
});
