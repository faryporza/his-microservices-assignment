import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ITimestamp, UserRole } from '@app/common';

@Entity({ name: 'users', database: 'iam_db' })
@Unique('uq_users_username', ['username'])
@Unique('uq_users_email', ['email'])
export class User implements ITimestamp {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_users' })
  id: string;

  @Column({ type: 'varchar', length: 100, comment: 'Unique login username' })
  username: string;

  @Column({
    type: 'varchar',
    length: 255,
    comment: 'Unique user email address',
  })
  email: string;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    comment: 'Bcrypt hashed password',
  })
  password_hash: string;

  @Column({
    name: 'first_name',
    type: 'varchar',
    length: 100,
    comment: 'User first name',
  })
  first_name: string;

  @Column({
    name: 'last_name',
    type: 'varchar',
    length: 100,
    comment: 'User last name',
  })
  last_name: string;

  @Index('idx_users_patient_id')
  @Column({
    type: 'uuid',
    nullable: true,
    comment:
      'Scalar UUID mapping to the patient identity in OPD; no cross-database foreign key',
  })
  patient_id?: string | null;

  @Index('idx_users_role')
  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.PATIENT,
    comment:
      'Assigned system role (ADMIN, DOCTOR, NURSE, FINANCE_STAFF, PATIENT)',
  })
  role: UserRole;

  @Index('idx_users_is_active')
  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
    comment: 'Account active flag',
  })
  is_active: boolean;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    comment: 'Account registration timestamp',
  })
  created_at: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    comment: 'Account details update timestamp',
  })
  updated_at: Date;
}
