import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('outbox_events')
@Unique('uq_outbox_events_event_id', ['event_id'])
@Index('idx_outbox_events_published_at', ['published_at'])
export class OutboxEvent {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_outbox_events',
  })
  id!: string;

  @Column({ type: 'uuid' })
  event_id!: string;

  @Column({ type: 'varchar' })
  event_name!: string;

  @Column({ type: 'jsonb' })
  event_data!: Record<string, unknown>;

  @Column({ type: 'timestamp with time zone' })
  occurred_at!: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  published_at!: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;
}
