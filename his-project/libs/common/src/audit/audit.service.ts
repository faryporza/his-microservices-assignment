import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  AccessAuditEvent,
  accessAuditEventName,
  accessAuditEventVersion,
} from '@app/contracts';
import { OutboxEventsService } from '../outbox/outbox-events.service';
import { AuditOutcome } from './entities/audit-log.entity';
import { StructuredLogger } from '../logging/structured.logger';

export interface LogAccessParams {
  actorId: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  ipAddress?: string | null;
  outcome: AuditOutcome;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new StructuredLogger('audit-service');

  constructor(private readonly outboxEvents: OutboxEventsService) {}

  async logAccess(params: LogAccessParams): Promise<void> {
    const event: AccessAuditEvent = {
      metadata: {
        eventId: randomUUID(),
        eventName: accessAuditEventName,
        version: accessAuditEventVersion,
        occurredAt: new Date().toISOString(),
      },
      payload: {
        actorId: params.actorId,
        actorRole: params.actorRole,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        ipAddress: params.ipAddress ?? null,
        outcome: params.outcome,
        metadata: params.metadata ?? null,
      },
    };

    await this.outboxEvents.runInTransaction(async (manager) => {
      await this.outboxEvents.enqueue(manager, accessAuditEventName, event);
    });
    await this.outboxEvents.publishPending();

    this.logger.log({
      message: 'Access audit event queued',
      context: {
        action: 'QUEUE_ACCESS_AUDIT',
        actor_id: params.actorId,
        actor_role: params.actorRole,
        resource_type: params.resourceType,
        resource_id: params.resourceId,
        outcome: params.outcome,
      },
    });
  }
}
