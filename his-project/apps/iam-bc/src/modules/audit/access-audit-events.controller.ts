import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import type { Channel, ConsumeMessage } from 'amqplib';
import {
  AccessAuditEvent,
  accessAuditEventName,
  accessAuditEventVersion,
  getEventIdForLog,
  hasValidEventMetadata,
} from '@app/contracts';
import { StructuredLogger } from '@app/common';
import { AccessAuditEventsService } from './access-audit-events.service';

@Controller()
export class AccessAuditEventsController {
  private readonly logger = new StructuredLogger('iam-bc');

  constructor(private readonly service: AccessAuditEventsService) {}

  @EventPattern(accessAuditEventName)
  async handleAccessAudit(
    @Payload() event: unknown,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    const channel = context.getChannelRef() as Channel;
    const message = context.getMessage() as ConsumeMessage;

    if (!this.isAccessAuditEvent(event)) {
      this.logger.warn({
        message: 'Invalid access audit event discarded',
        context: {
          action: 'CONSUME_ACCESS_AUDIT',
          event_id: getEventIdForLog(event),
          event_status: 'DISCARDED',
        },
      });
      channel.nack(message, false, false);
      return;
    }

    try {
      await this.service.persist(event);
      channel.ack(message);
      this.logger.log({
        message: 'Access audit event persisted',
        trace: {
          traceId: event.metadata.traceId,
          correlationId: event.metadata.correlationId,
        },
        context: {
          action: 'CONSUME_ACCESS_AUDIT',
          event_id: event.metadata.eventId,
          resource_type: event.payload.resourceType,
          resource_id: event.payload.resourceId,
          event_status: 'ACKED',
        },
      });
    } catch (error: unknown) {
      this.logger.error({
        message: 'Access audit persistence failed',
        context: {
          action: 'CONSUME_ACCESS_AUDIT',
          event_id: event.metadata.eventId,
          event_status: 'REQUEUED',
        },
        error,
      });
      channel.nack(message, false, true);
      throw error;
    }
  }

  private isAccessAuditEvent(event: unknown): event is AccessAuditEvent {
    if (typeof event !== 'object' || event === null) {
      return false;
    }

    const candidate = event as Partial<AccessAuditEvent>;
    const payload = candidate.payload;
    return (
      hasValidEventMetadata(
        candidate.metadata,
        accessAuditEventName,
        accessAuditEventVersion,
      ) &&
      typeof payload === 'object' &&
      payload !== null &&
      typeof payload.actorId === 'string' &&
      payload.actorId.length > 0 &&
      typeof payload.actorRole === 'string' &&
      payload.actorRole.length > 0 &&
      typeof payload.action === 'string' &&
      payload.action.length > 0 &&
      typeof payload.resourceType === 'string' &&
      payload.resourceType.length > 0 &&
      typeof payload.resourceId === 'string' &&
      payload.resourceId.length > 0 &&
      (payload.outcome === 'GRANTED' || payload.outcome === 'DENIED')
    );
  }
}
