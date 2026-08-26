import { BaseEvent } from './base-event.interface';

export type AccessAuditOutcome = 'GRANTED' | 'DENIED';

export interface AccessAuditPayload {
  actorId: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  ipAddress?: string | null;
  outcome: AccessAuditOutcome;
  metadata?: Record<string, unknown> | null;
}

export type AccessAuditEvent = BaseEvent<AccessAuditPayload>;

export const accessAuditEventName = 'access.audit';
export const accessAuditEventVersion = '1.0.0';
