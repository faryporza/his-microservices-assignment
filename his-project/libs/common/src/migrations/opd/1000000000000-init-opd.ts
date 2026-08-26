import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitOpd1000000000000 implements MigrationInterface {
  name = 'InitOpd1000000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id UUID NOT NULL DEFAULT gen_random_uuid(),
        hn VARCHAR(100) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        id_card VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT pk_patients PRIMARY KEY (id),
        CONSTRAINT uq_patients_hn UNIQUE (hn),
        CONSTRAINT uq_patients_id_card UNIQUE (id_card)
      );
      CREATE INDEX IF NOT EXISTS idx_patients_hn ON patients(hn);
      CREATE INDEX IF NOT EXISTS idx_patients_id_card ON patients(id_card);

      DO $$ BEGIN
        CREATE TYPE visit_status_enum AS ENUM ('OPEN', 'CLOSED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE IF NOT EXISTS visits (
        id UUID NOT NULL DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        visit_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        status visit_status_enum NOT NULL DEFAULT 'OPEN',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT pk_visits PRIMARY KEY (id),
        CONSTRAINT fk_visits_patients FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_visits_patient_id ON visits(patient_id);

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
      DROP TABLE IF EXISTS visits;
      DROP TABLE IF EXISTS patients;
      DROP TABLE IF EXISTS outbox_events;
      DROP TABLE IF EXISTS processed_events;
      DROP TYPE IF EXISTS visit_status_enum;
    `);
  }
}
