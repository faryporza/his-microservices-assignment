import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitFinance1000000000000 implements MigrationInterface {
  name = 'InitFinance1000000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE invoice_status_enum AS ENUM ('PENDING', 'PAID');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE IF NOT EXISTS invoices (
        id UUID NOT NULL DEFAULT gen_random_uuid(),
        visit_id VARCHAR(255) NOT NULL,
        record_id VARCHAR(255),
        patient_id VARCHAR(255),
        correlation_id VARCHAR(255),
        total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        status invoice_status_enum NOT NULL DEFAULT 'PENDING',
        paid_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT pk_invoices PRIMARY KEY (id),
        CONSTRAINT uq_invoices_visit_id UNIQUE (visit_id)
      );
      CREATE INDEX IF NOT EXISTS idx_invoices_visit_id ON invoices(visit_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_patient_id ON invoices(patient_id);

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
      DROP TABLE IF EXISTS invoices;
      DROP TABLE IF EXISTS outbox_events;
      DROP TABLE IF EXISTS processed_events;
      DROP TYPE IF EXISTS invoice_status_enum;
    `);
  }
}
