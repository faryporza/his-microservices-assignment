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

  @Column({ type: 'uuid', comment: 'Unique domain event UUID' })
  event_id!: string;

  @Column({ type: 'varchar', length: 100, comment: 'Event name / routing key' })
  event_name!: string;

  @Column({
    type: 'jsonb',
    comment: 'Full event envelope and payload payload in JSON format',
  })
  event_data!: Record<string, unknown>;

  @Column({
    type: 'timestamptz',
    comment: 'Timestamp when domain event occurred',
  })
  occurred_at!: Date;

  @Column({
    type: 'timestamptz',
    nullable: true,
    comment: 'Timestamp when message was successfully published to broker',
  })
  published_at!: Date | null;

  @CreateDateColumn({
    type: 'timestamptz',
    comment: 'Timestamp when outbox row was inserted',
  })
  created_at!: Date;
}
