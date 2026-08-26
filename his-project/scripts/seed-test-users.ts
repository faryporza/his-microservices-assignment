import { Pool } from 'pg';
import bcrypt from 'bcrypt';

/**
 * Creates deterministic staff accounts only for an explicitly enabled test
 * environment. This file must never be called by application bootstrap or a
 * production migration.
 */
const users = [
  ['admin_test_user', 'admin_test@hospital.local', 'Super', 'Admin', 'ADMIN'],
  [
    'doctor_test_user',
    'doctor_test@hospital.local',
    'John',
    'Watson',
    'DOCTOR',
  ],
  [
    'nurse_test_user',
    'nurse_test@hospital.local',
    'Florence',
    'Nightingale',
    'NURSE',
  ],
  [
    'finance_test_user',
    'finance_test@hospital.local',
    'Penny',
    'Accountant',
    'FINANCE_STAFF',
  ],
] as const;

async function main(): Promise<void> {
  const requiredTestSeedFlag = process.env.ALLOW_TEST_SEED === 'true';
  if (process.env.NODE_ENV !== 'test' || !requiredTestSeedFlag) {
    throw new Error(
      'Refusing to seed users: set NODE_ENV=test and ALLOW_TEST_SEED=true',
    );
  }

  const password = process.env.TEST_SEED_PASSWORD;
  if (!password) {
    throw new Error('TEST_SEED_PASSWORD is required for the test-only seed');
  }

  const pool = new Pool({
    host: process.env.POSTGRES_HOST ?? '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USERNAME ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
    database: process.env.IAM_DATABASE ?? 'iam_db',
  });

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    for (const [username, email, firstName, lastName, role] of users) {
      await pool.query(
        `
          INSERT INTO users
            (username, email, password_hash, first_name, last_name, role, is_active)
          VALUES ($1, $2, $3, $4, $5, $6::user_role_enum, true)
          ON CONFLICT (username) DO UPDATE SET
            email = EXCLUDED.email,
            password_hash = EXCLUDED.password_hash,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            role = EXCLUDED.role,
            is_active = true
        `,
        [username, email, passwordHash, firstName, lastName, role],
      );
    }
    process.stdout.write(`Seeded ${users.length} test-only IAM users\n`);
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
