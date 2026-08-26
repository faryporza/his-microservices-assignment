import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum AuditOutcome {
  GRANTED = 'GRANTED',
  DENIED = 'DENIED',
}

@Entity({ name: 'audit_logs', database: 'iam_db' })
@Index('idx_audit_logs_actor_id', ['actor_id'])
@Index('idx_audit_logs_resource', ['resource_type', 'resource_id'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_audit_logs' })
  id: string;

  @Column({ type: 'varchar', length: 100, comment: 'Identifier of the actor' })
  actor_id: string;

  @Column({ type: 'varchar', length: 50, comment: 'Role of the actor' })
  actor_role: string;

  @Column({
    type: 'varchar',
    length: 100,
    comment: 'Action performed (e.g. READ_RECORD, CREATE_VISIT)',
  })
  action: string;

  @Column({
    type: 'varchar',
    length: 50,
    comment: 'Target resource type (e.g. medical_record, visit, invoice)',
  })
  resource_type: string;

  @Column({
    type: 'varchar',
    length: 100,
    comment: 'Target resource identifier',
  })
  resource_id: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    comment: 'Client IP address',
  })
  ip_address: string | null;

  @Column({
    type: 'enum',
    enum: AuditOutcome,
    default: AuditOutcome.GRANTED,
    comment: 'Access authorization outcome',
  })
  outcome: AuditOutcome;

  @Column({
    type: 'jsonb',
    nullable: true,
    comment: 'Additional contextual metadata',
  })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({
    type: 'timestamptz',
    comment: 'Timestamp when audit log was recorded',
  })
  created_at: Date;
}
