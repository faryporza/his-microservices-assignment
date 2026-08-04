import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('processed_events')
@Index('uq_processed_events_event_id', ['event_id'], { unique: true })
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
