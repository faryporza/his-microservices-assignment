import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { RenameUniqueConstraints20260805000000 } from '../migrations/rename-unique-constraints.migration';
import { RenameMigrationsPrimaryKey20260805000100 } from '../migrations/rename-migrations-primary-key.migration';

export function getRequiredString(config: ConfigService, key: string): string {
  return config.getOrThrow<string>(key);
}

export function getRequiredSecret(
  config: ConfigService,
  key: string,
  minLength = 32,
): string {
  const value = getRequiredString(config, key);
  if (value.length < minLength) {
    throw new Error(
      `Environment variable ${key} must have at least ${minLength} characters of entropy`,
    );
  }
  return value;
}

export function parseDurationToSeconds(
  duration: string,
  defaultSeconds = 900,
): number {
  if (!duration) return defaultSeconds;
  const match = /^(\d+)([smhdwy])?$/i.exec(duration.trim());
  if (!match) return defaultSeconds;
  const amount = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  switch (unit) {
    case 's':
      return amount;
    case 'm':
      return amount * 60;
    case 'h':
      return amount * 3600;
    case 'd':
      return amount * 86400;
    case 'w':
      return amount * 604800;
    case 'y':
      return amount * 31536000;
    default:
      return defaultSeconds;
  }
}

export function getRequiredInteger(config: ConfigService, key: string): number {
  const value = getRequiredString(config, key);
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${key} must be a positive integer`);
  }

  return parsed;
}

export interface PostgresOptionsOverrides {
  entities?: TypeOrmModuleOptions['entities'];
  migrations?: TypeOrmModuleOptions['migrations'];
  synchronize?: boolean;
}

export function createPostgresOptions(
  config: ConfigService,
  databaseKey: string,
  overrides?: PostgresOptionsOverrides,
): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: getRequiredString(config, 'POSTGRES_HOST'),
    port: getRequiredInteger(config, 'POSTGRES_PORT'),
    username: getRequiredString(config, 'POSTGRES_USERNAME'),
    password: getRequiredString(config, 'POSTGRES_PASSWORD'),
    database: getRequiredString(config, databaseKey),
    entities: overrides?.entities,
    autoLoadEntities: !overrides?.entities,
    synchronize: overrides?.synchronize ?? false,
    migrations: overrides?.migrations ?? [
      RenameUniqueConstraints20260805000000,
      RenameMigrationsPrimaryKey20260805000100,
    ],
    migrationsRun: true,
  };
}
