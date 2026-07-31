import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('processed_events')
@Index('UQ_processed_events_event_id', ['eventId'], { unique: true })
export class ProcessedEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'event_id' })
  eventId!: string;

  @Column({ type: 'varchar', name: 'event_name' })
  eventName!: string;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'processed_at' })
  processedAt!: Date;
}
