import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum RecordStatus {
  WAITING = 'WAITING',
  COMPLETED = 'COMPLETED',
}

@Entity('medical_records')
export class MedicalRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'visit_id' })
  visitId!: string;

  @Column({ name: 'patient_id', nullable: true })
  patientId?: string | null;

  @Column({ type: 'text', nullable: true })
  diagnosis?: string | null;

  @Column({ name: 'treatment_note', type: 'text', nullable: true })
  treatmentNote?: string | null;

  @Column({ name: 'doctor_id', nullable: true })
  doctorId?: string | null;

  @Column({
    name: 'treatment_cost',
    type: 'decimal',
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
