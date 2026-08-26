import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Unique,
} from 'typeorm';
import { ITimestamp } from '@app/common';
import { Visit } from '@apps/opd-bc/modules/visit/entities/visit.entity';

@Entity({ name: 'patients', database: 'opd_db' })
@Unique('uq_patients_hn', ['hn'])
@Unique('uq_patients_id_card', ['id_card'])
export class Patient implements ITimestamp {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_patients' })
  id!: string;

  @Column({
    type: 'varchar',
    length: 50,
    comment: 'Hospital Number (unique patient identifier)',
  })
  hn!: string;

  @Column({ type: 'varchar', length: 100, comment: 'Patient first name' })
  first_name!: string;

  @Column({ type: 'varchar', length: 100, comment: 'Patient last name' })
  last_name!: string;

  @Column({
    type: 'varchar',
    length: 20,
    comment: 'National ID card or passport number',
  })
  id_card!: string;

  @OneToMany(() => Visit, (visit) => visit.patient)
  visits!: Visit[];

  @CreateDateColumn({
    type: 'timestamptz',
    comment: 'Timestamp when patient was registered',
  })
  created_at!: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    comment: 'Timestamp when patient record was last updated',
  })
  updated_at!: Date;
}
