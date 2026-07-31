import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum InvoiceStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
}

@Entity('invoices')
@Index('UQ_invoices_visit_id', ['visitId'], { unique: true })
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Scalar references only: Finance must not create a foreign key to another DB.
  @Column({ type: 'varchar', name: 'visit_id' })
  visitId!: string;

  @Column({ type: 'varchar', name: 'record_id', nullable: true })
  recordId?: string | null;

  // PostgreSQL decimals are returned by TypeORM as strings to preserve precision.
  @Column({ type: 'decimal', name: 'total_amount', precision: 12, scale: 2 })
  totalAmount!: string;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.PENDING,
  })
  status!: InvoiceStatus;

  @Column({ type: 'timestamp with time zone', name: 'paid_at', nullable: true })
  paidAt?: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt!: Date;
}
