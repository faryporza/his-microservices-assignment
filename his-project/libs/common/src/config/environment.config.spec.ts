import { ConfigService } from '@nestjs/config';
import {
  createPostgresOptions,
  getRequiredInteger,
  getRequiredString,
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
    ).toHaveLength(2);
  });

  it('rejects an invalid numeric environment value', () => {
    values.POSTGRES_PORT = 'not-a-port';
    expect(() => getRequiredInteger(config, 'POSTGRES_PORT')).toThrow(
      'POSTGRES_PORT must be a positive integer',
    );
    values.POSTGRES_PORT = '5432';
  });
});
