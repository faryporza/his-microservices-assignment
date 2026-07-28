import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';

export enum VisitStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

@Entity('visits')
export class Visit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'patient_id' })
  patientId!: string;

  @ManyToOne(() => Patient, (patient) => patient.visits, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @CreateDateColumn({ name: 'visit_date' })
  visitDate!: Date;

  @Column({
    type: 'enum',
    enum: VisitStatus,
    default: VisitStatus.OPEN,
  })
  status!: VisitStatus;
}
