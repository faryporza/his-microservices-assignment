import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes the legacy credentials that were accidentally shipped in the first
 * IAM migration and adds the explicit identity-to-patient projection needed by
 * resource ownership policies. Test credentials are created only by the
 * guarded test seed command.
 */
export class HardenIam1000000000001 implements MigrationInterface {
  name = 'HardenIam1000000000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS patient_id UUID;

      CREATE UNIQUE INDEX IF NOT EXISTS uq_users_patient_id
        ON users(patient_id)
        WHERE patient_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_users_patient_id ON users(patient_id);

      DELETE FROM users
      WHERE username IN (
        'admin_test_user',
        'doctor_test_user',
        'nurse_test_user',
        'finance_test_user',
        'patient_test_user'
      )
      OR email IN (
        'admin_test@hospital.local',
        'doctor_test@hospital.local',
        'nurse_test@hospital.local',
        'finance_test@hospital.local',
        'patient_test@hospital.local'
      );

      COMMENT ON COLUMN users.patient_id IS
        'Scalar UUID mapping to the patient identity in OPD; no cross-database foreign key';
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_users_patient_id;
      DROP INDEX IF EXISTS idx_users_patient_id;
      ALTER TABLE users DROP COLUMN IF EXISTS patient_id;
    `);
  }
}
