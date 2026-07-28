import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('processed_events')
export class ProcessedEvent {
  @PrimaryColumn({ type: 'uuid', name: 'event_id' })
  eventId!: string;

  @CreateDateColumn({
    type: 'timestamp with time zone',
    name: 'processed_at',
  })
  processedAt!: Date;
}
