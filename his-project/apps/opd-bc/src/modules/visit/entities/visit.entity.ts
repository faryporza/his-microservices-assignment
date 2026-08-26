import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ITimestamp } from '@app/common';
import { Patient } from '@apps/opd-bc/modules/patient/entities/patient.entity';

export enum VisitStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

@Entity({ name: 'visits', database: 'opd_db' })
@Index('idx_visits_patient_id', ['patient_id'])
export class Visit implements ITimestamp {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_visits' })
  id!: string;

  @Column({ type: 'uuid', comment: 'Patient UUID foreign key' })
  patient_id!: string;

  @ManyToOne(() => Patient, (patient) => patient.visits, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'patient_id',
    foreignKeyConstraintName: 'fk_visits_patients',
  })
  patient!: Patient;

  @CreateDateColumn({
    type: 'timestamptz',
    comment: 'Visit creation timestamp',
  })
  created_at!: Date;

  @CreateDateColumn({
    type: 'timestamptz',
    comment: 'Date and time of visit check-in',
  })
  visit_date!: Date;

  @Column({
    type: 'enum',
    enum: VisitStatus,
    default: VisitStatus.OPEN,
    comment: 'Status of the outpatient visit (OPEN or CLOSED)',
  })
  status!: VisitStatus;

  @UpdateDateColumn({
    type: 'timestamptz',
    comment: 'Timestamp when visit record was last updated',
  })
  updated_at!: Date;
}
