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
@Index('UQ_medical_records_visit_id', ['visitId'], { unique: true })
export class MedicalRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', name: 'visit_id' })
  visitId!: string;

  @Column({ type: 'varchar', name: 'patient_id', nullable: true })
  patientId?: string | null;

  @Column({ type: 'text', nullable: true })
  diagnosis?: string | null;

  @Column({ type: 'text', name: 'treatment_note', nullable: true })
  treatmentNote?: string | null;

  @Column({ type: 'varchar', name: 'doctor_id', nullable: true })
  doctorId?: string | null;

  @Column({
    type: 'decimal',
    name: 'treatment_cost',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  treatmentCost?: number | null;

  @Column({
    type: 'enum',
    enum: RecordStatus,
    default: RecordStatus.WAITING,
  })
  status!: RecordStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
