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
import { Patient } from '@apps/opd-bc/modules/patient/entities/patient.entity';

export enum VisitStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

@Entity('visits')
@Index('idx_visits_patient_id', ['patient_id'])
export class Visit {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_visits' })
  id!: string;

  @Column()
  patient_id!: string;

  @ManyToOne(() => Patient, (patient) => patient.visits, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'patient_id',
    foreignKeyConstraintName: 'fk_visits_patients',
  })
  patient!: Patient;

  @CreateDateColumn()
  visit_date!: Date;

  @Column({
    type: 'enum',
    enum: VisitStatus,
    default: VisitStatus.OPEN,
  })
  status!: VisitStatus;

  @UpdateDateColumn()
  updated_at!: Date;
}
