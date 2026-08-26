import { ConfigService } from '@nestjs/config';
import {
  createPostgresOptions,
  getRequiredInteger,
  getRequiredSecret,
  getRequiredString,
  parseDurationToSeconds,
} from './environment.config';

describe('environment configuration helpers', () => {
  const values: Record<string, string> = {
    POSTGRES_HOST: 'db.internal',
    POSTGRES_PORT: '5432',
    POSTGRES_USERNAME: 'app',
    POSTGRES_PASSWORD: 'secret',
    OPD_DATABASE: 'opd_db',
  };
  const config = {
    getOrThrow: jest.fn((key: string) => {
      const value = values[key];
      if (value === undefined) {
        throw new Error(`Missing ${key}`);
      }
      return value;
    }),
  } as unknown as ConfigService;

  beforeEach(() => jest.clearAllMocks());

  it('reads required values without application defaults', () => {
    expect(getRequiredString(config, 'POSTGRES_HOST')).toBe('db.internal');
    expect(getRequiredInteger(config, 'POSTGRES_PORT')).toBe(5432);
  });

  it('builds a service-owned PostgreSQL configuration', () => {
    expect(createPostgresOptions(config, 'OPD_DATABASE')).toMatchObject({
      type: 'postgres',
      host: 'db.internal',
      port: 5432,
      username: 'app',
      password: 'secret',
      database: 'opd_db',
      migrationsRun: true,
    });

    expect(
      createPostgresOptions(config, 'OPD_DATABASE').migrations,
    ).toHaveLength(3);
  });

  it('rejects an invalid numeric environment value', () => {
    values.POSTGRES_PORT = 'not-a-port';
    expect(() => getRequiredInteger(config, 'POSTGRES_PORT')).toThrow(
      'POSTGRES_PORT must be a positive integer',
    );
    values.POSTGRES_PORT = '5432';
  });

  it('validates secret entropy requiring at least 32 characters', () => {
    values.JWT_SECRET = 'short-secret';
    expect(() => getRequiredSecret(config, 'JWT_SECRET')).toThrow(
      'Environment variable JWT_SECRET must have at least 32 characters',
    );

    values.JWT_SECRET = 'a-very-strong-secret-key-that-exceeds-32-chars-long';
    expect(getRequiredSecret(config, 'JWT_SECRET')).toBe(
      'a-very-strong-secret-key-that-exceeds-32-chars-long',
    );
  });

  it('parses duration strings into seconds correctly', () => {
    expect(parseDurationToSeconds('15m', 900)).toBe(900);
    expect(parseDurationToSeconds('1h', 3600)).toBe(3600);
    expect(parseDurationToSeconds('7d', 604800)).toBe(604800);
    expect(parseDurationToSeconds('30s', 30)).toBe(30);
    expect(parseDurationToSeconds('120', 120)).toBe(120);
    expect(parseDurationToSeconds('invalid', 900)).toBe(900);
  });
});
