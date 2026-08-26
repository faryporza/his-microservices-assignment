import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitIam1000000000000 implements MigrationInterface {
  name = 'InitIam1000000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE user_role_enum AS ENUM ('ADMIN', 'DOCTOR', 'NURSE', 'FINANCE_STAFF', 'PATIENT');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE IF NOT EXISTS users (
        id UUID NOT NULL DEFAULT gen_random_uuid(),
        username VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role user_role_enum NOT NULL DEFAULT 'PATIENT',
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT pk_users PRIMARY KEY (id),
        CONSTRAINT uq_users_username UNIQUE (username),
        CONSTRAINT uq_users_email UNIQUE (email)
      );
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID NOT NULL DEFAULT gen_random_uuid(),
        actor_id VARCHAR(100) NOT NULL,
        actor_role VARCHAR(50) NOT NULL,
        action VARCHAR(50) NOT NULL,
        resource_type VARCHAR(50) NOT NULL,
        resource_id VARCHAR(100) NOT NULL,
        ip_address VARCHAR(45),
        outcome VARCHAR(20) NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT pk_audit_logs PRIMARY KEY (id)
      );
      CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

      CREATE TABLE IF NOT EXISTS outbox_events (
        id UUID NOT NULL DEFAULT gen_random_uuid(),
        event_id UUID NOT NULL,
        event_name VARCHAR(255) NOT NULL,
        event_data JSONB NOT NULL,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT pk_outbox_events PRIMARY KEY (id),
        CONSTRAINT uq_outbox_events_event_id UNIQUE (event_id)
      );
      CREATE INDEX IF NOT EXISTS idx_outbox_events_published_at ON outbox_events(published_at);

      CREATE TABLE IF NOT EXISTS processed_events (
        id UUID NOT NULL DEFAULT gen_random_uuid(),
        event_id UUID NOT NULL,
        event_name VARCHAR(255) NOT NULL,
        processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT pk_processed_events PRIMARY KEY (id),
        CONSTRAINT uq_processed_events_event_id UNIQUE (event_id)
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS audit_logs;
      DROP TABLE IF EXISTS users;
      DROP TABLE IF EXISTS outbox_events;
      DROP TABLE IF EXISTS processed_events;
      DROP TYPE IF EXISTS user_role_enum;
    `);
  }
}
