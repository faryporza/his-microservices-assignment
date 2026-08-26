import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds entity documentation to PostgreSQL itself, not only TypeORM metadata. */
export class AddSchemaComments20260826000000 implements MigrationInterface {
  name = 'AddSchemaComments20260826000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.patients') IS NOT NULL THEN
          COMMENT ON TABLE patients IS 'OPD patient identity records';
          COMMENT ON COLUMN patients.id IS 'Patient UUID';
          COMMENT ON COLUMN patients.hn IS 'Hospital Number (unique patient identifier)';
          COMMENT ON COLUMN patients.first_name IS 'Patient first name';
          COMMENT ON COLUMN patients.last_name IS 'Patient last name';
          COMMENT ON COLUMN patients.id_card IS 'National ID card or passport number';
          COMMENT ON COLUMN patients.created_at IS 'Timestamp when patient was registered';
          COMMENT ON COLUMN patients.updated_at IS 'Timestamp when patient record was last updated';
        END IF;

        IF to_regclass('public.visits') IS NOT NULL THEN
          COMMENT ON TABLE visits IS 'OPD outpatient visit lifecycle records';
          COMMENT ON COLUMN visits.id IS 'Visit UUID';
          COMMENT ON COLUMN visits.patient_id IS 'Patient UUID foreign key within OPD';
          COMMENT ON COLUMN visits.visit_date IS 'Date and time of visit check-in';
          COMMENT ON COLUMN visits.status IS 'Status of the outpatient visit (OPEN or CLOSED)';
          COMMENT ON COLUMN visits.created_at IS 'Timestamp when visit was created';
          COMMENT ON COLUMN visits.updated_at IS 'Timestamp when visit was last updated';
        END IF;

        IF to_regclass('public.medical_records') IS NOT NULL THEN
          COMMENT ON TABLE medical_records IS 'EMR clinical medical records';
          COMMENT ON COLUMN medical_records.id IS 'Medical record UUID';
          COMMENT ON COLUMN medical_records.visit_id IS 'Scalar reference to an OPD visit';
          COMMENT ON COLUMN medical_records.patient_id IS 'Patient identifier projection from OPD';
          COMMENT ON COLUMN medical_records.correlation_id IS 'Correlation ID for distributed tracing';
          COMMENT ON COLUMN medical_records.diagnosis IS 'Clinical diagnosis text';
          COMMENT ON COLUMN medical_records.treatment_note IS 'Physician treatment notes and observations';
          COMMENT ON COLUMN medical_records.doctor_id IS 'Doctor identifier';
          COMMENT ON COLUMN medical_records.treatment_cost IS 'Cost of medical treatment in THB';
          COMMENT ON COLUMN medical_records.status IS 'Status of the medical record (WAITING or COMPLETED)';
          COMMENT ON COLUMN medical_records.created_at IS 'Timestamp when medical record was created';
          COMMENT ON COLUMN medical_records.updated_at IS 'Timestamp when medical record was last updated';
        END IF;

        IF to_regclass('public.invoices') IS NOT NULL THEN
          COMMENT ON TABLE invoices IS 'Finance invoice and payment records';
          COMMENT ON COLUMN invoices.id IS 'Invoice UUID';
          COMMENT ON COLUMN invoices.visit_id IS 'Scalar reference to an OPD visit';
          COMMENT ON COLUMN invoices.record_id IS 'Scalar reference to an EMR medical record';
          COMMENT ON COLUMN invoices.patient_id IS 'Patient identifier projection from treatment event';
          COMMENT ON COLUMN invoices.correlation_id IS 'Correlation ID for distributed tracing';
          COMMENT ON COLUMN invoices.total_amount IS 'Total invoice amount in THB';
          COMMENT ON COLUMN invoices.status IS 'Status of the invoice (PENDING or PAID)';
          COMMENT ON COLUMN invoices.paid_at IS 'Timestamp when payment was confirmed';
          COMMENT ON COLUMN invoices.created_at IS 'Timestamp when invoice was generated';
          COMMENT ON COLUMN invoices.updated_at IS 'Timestamp when invoice was last updated';
        END IF;

        IF to_regclass('public.users') IS NOT NULL THEN
          COMMENT ON TABLE users IS 'IAM user accounts and identity projections';
          COMMENT ON COLUMN users.id IS 'User UUID';
          COMMENT ON COLUMN users.username IS 'Unique login username';
          COMMENT ON COLUMN users.email IS 'Unique user email address';
          COMMENT ON COLUMN users.password_hash IS 'Bcrypt password hash';
          COMMENT ON COLUMN users.first_name IS 'User first name';
          COMMENT ON COLUMN users.last_name IS 'User last name';
          COMMENT ON COLUMN users.patient_id IS 'Scalar UUID mapping to the patient identity in OPD; no cross-database foreign key';
          COMMENT ON COLUMN users.role IS 'Assigned system role';
          COMMENT ON COLUMN users.is_active IS 'Account active flag';
          COMMENT ON COLUMN users.created_at IS 'Account registration timestamp';
          COMMENT ON COLUMN users.updated_at IS 'Account details update timestamp';
        END IF;

        IF to_regclass('public.audit_logs') IS NOT NULL THEN
          COMMENT ON TABLE audit_logs IS 'Append-only IAM access audit records';
        END IF;

        IF to_regclass('public.outbox_events') IS NOT NULL THEN
          COMMENT ON TABLE outbox_events IS 'Service-local transactional outbox records';
          COMMENT ON COLUMN outbox_events.id IS 'Outbox row UUID';
          COMMENT ON COLUMN outbox_events.event_id IS 'Unique domain event UUID';
          COMMENT ON COLUMN outbox_events.event_name IS 'Event name / routing key';
          COMMENT ON COLUMN outbox_events.event_data IS 'Full event envelope and payload';
          COMMENT ON COLUMN outbox_events.occurred_at IS 'Timestamp when domain event occurred';
          COMMENT ON COLUMN outbox_events.published_at IS 'Timestamp when event was published';
          COMMENT ON COLUMN outbox_events.created_at IS 'Timestamp when outbox row was inserted';
        END IF;

        IF to_regclass('public.processed_events') IS NOT NULL THEN
          COMMENT ON TABLE processed_events IS 'Service-local idempotent consumer markers';
          COMMENT ON COLUMN processed_events.id IS 'Processed-event row UUID';
          COMMENT ON COLUMN processed_events.event_id IS 'Consumed event UUID';
          COMMENT ON COLUMN processed_events.event_name IS 'Consumed event routing key/name';
          COMMENT ON COLUMN processed_events.processed_at IS 'Timestamp when event processing committed';
        END IF;
      END $$;
    `);
  }

  down(): Promise<void> {
    // Retain metadata comments on rollback; they are non-destructive schema documentation.
    return Promise.resolve();
  }
}
