import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ITimestamp } from '@app/common';

export enum RecordStatus {
  WAITING = 'WAITING',
  COMPLETED = 'COMPLETED',
}

@Entity({ name: 'medical_records', database: 'emr_db' })
@Unique('uq_medical_records_visit_id', ['visit_id'])
@Index('idx_medical_records_patient_id', ['patient_id'])
export class MedicalRecord implements ITimestamp {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_medical_records',
  })
  id!: string;

  @Column({
    type: 'varchar',
    length: 100,
    comment: 'Visit identifier (scalar reference to OPD visit)',
  })
  visit_id!: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: 'Patient identifier projection from OPD visit',
  })
  patient_id?: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: 'Correlation ID for distributed tracing',
  })
  correlation_id?: string | null;

  @Column({ type: 'text', nullable: true, comment: 'Clinical diagnosis text' })
  diagnosis?: string | null;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'Physician treatment notes and observations',
  })
  treatment_note?: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: 'Doctor identifier',
  })
  doctor_id?: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    comment: 'Cost of medical treatment in THB',
  })
  treatment_cost?: number | null;

  @Column({
    type: 'enum',
    enum: RecordStatus,
    default: RecordStatus.WAITING,
    comment: 'Status of the medical record (WAITING or COMPLETED)',
  })
  status!: RecordStatus;

  @CreateDateColumn({
    type: 'timestamptz',
    comment: 'Timestamp when medical record was created',
  })
  created_at!: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    comment: 'Timestamp when medical record was last updated',
  })
  updated_at!: Date;
}
