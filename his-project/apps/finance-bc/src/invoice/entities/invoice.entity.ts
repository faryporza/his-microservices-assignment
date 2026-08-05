import {
  Column,
  CreateDateColumn,
  Entity,
  Unique,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum InvoiceStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
}

@Entity('invoices')
@Unique('uq_invoices_visit_id', ['visit_id'])
export class Invoice {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_invoices' })
  id!: string;

  // Scalar references only: Finance must not create a foreign key to another DB.
  @Column({ type: 'varchar' })
  visit_id!: string;

  @Column({ type: 'varchar', nullable: true })
  record_id?: string | null;

  @Column({ type: 'varchar', nullable: true })
  correlation_id?: string | null;

  // PostgreSQL decimals are returned by TypeORM as strings to preserve precision.
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total_amount!: string;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.PENDING,
  })
  status!: InvoiceStatus;

  @Column({ type: 'timestamp with time zone', nullable: true })
  paid_at?: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}
