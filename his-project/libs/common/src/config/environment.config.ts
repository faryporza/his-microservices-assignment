import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export function getRequiredString(config: ConfigService, key: string): string {
  return config.getOrThrow<string>(key);
}

export function getRequiredInteger(config: ConfigService, key: string): number {
  const value = getRequiredString(config, key);
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${key} must be a positive integer`);
  }

  return parsed;
}

export function createPostgresOptions(
  config: ConfigService,
  databaseKey: string,
): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: getRequiredString(config, 'POSTGRES_HOST'),
    port: getRequiredInteger(config, 'POSTGRES_PORT'),
    username: getRequiredString(config, 'POSTGRES_USERNAME'),
    password: getRequiredString(config, 'POSTGRES_PASSWORD'),
    database: getRequiredString(config, databaseKey),
    autoLoadEntities: true,
    synchronize: true,
  };
}
