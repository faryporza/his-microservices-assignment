import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitEmr1000000000000 implements MigrationInterface {
  name = 'InitEmr1000000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE record_status_enum AS ENUM ('WAITING', 'COMPLETED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE IF NOT EXISTS medical_records (
        id UUID NOT NULL DEFAULT gen_random_uuid(),
        visit_id VARCHAR(255) NOT NULL,
        patient_id VARCHAR(255),
        correlation_id VARCHAR(255),
        diagnosis TEXT,
        treatment_note TEXT,
        doctor_id VARCHAR(255),
        treatment_cost NUMERIC(10, 2),
        status record_status_enum NOT NULL DEFAULT 'WAITING',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT pk_medical_records PRIMARY KEY (id),
        CONSTRAINT uq_medical_records_visit_id UNIQUE (visit_id)
      );
      CREATE INDEX IF NOT EXISTS idx_medical_records_visit_id ON medical_records(visit_id);
      CREATE INDEX IF NOT EXISTS idx_medical_records_patient_id ON medical_records(patient_id);

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
      DROP TABLE IF EXISTS medical_records;
      DROP TABLE IF EXISTS outbox_events;
      DROP TABLE IF EXISTS processed_events;
      DROP TYPE IF EXISTS record_status_enum;
    `);
  }
}
