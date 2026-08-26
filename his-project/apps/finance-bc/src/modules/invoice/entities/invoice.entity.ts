import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  Unique,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ITimestamp } from '@app/common';

export enum InvoiceStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
}

@Entity({ name: 'invoices', database: 'finance_db' })
@Unique('uq_invoices_visit_id', ['visit_id'])
@Index('idx_invoices_patient_id', ['patient_id'])
export class Invoice implements ITimestamp {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_invoices' })
  id!: string;

  // Scalar references only: Finance must not create a foreign key to another DB.
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
    comment: 'Medical record identifier',
  })
  record_id?: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: 'Patient identifier projection from treatment event',
  })
  patient_id?: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: 'Correlation ID for distributed tracing',
  })
  correlation_id?: string | null;

  // PostgreSQL decimals are returned by TypeORM as strings to preserve precision.
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    comment: 'Total invoice amount in THB',
  })
  total_amount!: string;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.PENDING,
    comment: 'Status of the invoice (PENDING or PAID)',
  })
  status!: InvoiceStatus;

  @Column({
    type: 'timestamptz',
    nullable: true,
    comment: 'Timestamp when payment was confirmed',
  })
  paid_at?: Date | null;

  @CreateDateColumn({
    type: 'timestamptz',
    comment: 'Timestamp when invoice was generated',
  })
  created_at!: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    comment: 'Timestamp when invoice was last updated',
  })
  updated_at!: Date;
}
