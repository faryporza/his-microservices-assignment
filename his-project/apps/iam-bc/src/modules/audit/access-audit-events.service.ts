import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AccessAuditEvent } from '@app/contracts';
import { AuditLog, AuditOutcome, IdempotencyService } from '@app/common';

@Injectable()
export class AccessAuditEventsService {
  constructor(private readonly idempotency: IdempotencyService) {}

  async persist(event: AccessAuditEvent): Promise<void> {
    await this.idempotency.process(
      event.metadata.eventId,
      event.metadata.eventName,
      async (manager: EntityManager) => {
        const repository = manager.getRepository(AuditLog);
        const entry = repository.create({
          actor_id: event.payload.actorId,
          actor_role: event.payload.actorRole,
          action: event.payload.action,
          resource_type: event.payload.resourceType,
          resource_id: event.payload.resourceId,
          ip_address: event.payload.ipAddress ?? null,
          outcome:
            event.payload.outcome === 'DENIED'
              ? AuditOutcome.DENIED
              : AuditOutcome.GRANTED,
          metadata: event.payload.metadata ?? null,
        });
        await repository.save(entry);
      },
    );
  }
}
