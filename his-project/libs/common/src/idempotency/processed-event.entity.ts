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

  @Column({ type: 'uuid' })
  event_id!: string;

  @Column({ type: 'varchar' })
  event_name!: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  processed_at!: Date;
}
