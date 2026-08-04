import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  UpdateDateColumn,
} from 'typeorm';

export enum RecordStatus {
  WAITING = 'WAITING',
  COMPLETED = 'COMPLETED',
}

@Entity('medical_records')
@Index('uq_medical_records_visit_id', ['visit_id'], { unique: true })
export class MedicalRecord {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_medical_records',
  })
  id!: string;

  @Column({ type: 'varchar' })
  visit_id!: string;

  @Column({ type: 'varchar', nullable: true })
  patient_id?: string | null;

  @Column({ type: 'varchar', nullable: true })
  correlation_id?: string | null;

  @Column({ type: 'text', nullable: true })
  diagnosis?: string | null;

  @Column({ type: 'text', nullable: true })
  treatment_note?: string | null;

  @Column({ type: 'varchar', nullable: true })
  doctor_id?: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  treatment_cost?: number | null;

  @Column({
    type: 'enum',
    enum: RecordStatus,
    default: RecordStatus.WAITING,
  })
  status!: RecordStatus;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
