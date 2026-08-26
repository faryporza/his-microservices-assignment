import {
  Column,
  CreateDateColumn,
  Entity,
  Unique,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('processed_events')
@Unique('uq_processed_events_event_id', ['event_id'])
export class ProcessedEvent {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_processed_events',
  })
  id!: string;

  @Column({ type: 'uuid', comment: 'Consumed event UUID' })
  event_id!: string;

  @Column({
    type: 'varchar',
    length: 100,
    comment: 'Consumed event routing key/name',
  })
  event_name!: string;

  @CreateDateColumn({
    type: 'timestamptz',
    comment: 'Timestamp when event was processed and committed',
  })
  processed_at!: Date;
}
