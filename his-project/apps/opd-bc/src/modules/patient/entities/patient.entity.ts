import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Unique,
} from 'typeorm';
import { Visit } from '@apps/opd-bc/modules/visit/entities/visit.entity';

@Entity('patients')
@Unique('uq_patients_hn', ['hn'])
@Unique('uq_patients_id_card', ['id_card'])
export class Patient {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_patients' })
  id!: string;

  @Column()
  hn!: string;

  @Column()
  first_name!: string;

  @Column()
  last_name!: string;

  @Column()
  id_card!: string;

  @OneToMany(() => Visit, (visit) => visit.patient)
  visits!: Visit[];

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
