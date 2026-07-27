import { BaseEvent } from './base-event.interface';

export interface VisitCreatedPayload {
  visitId: string;
  patientId: string;
  timestamp: string;
}

export type VisitCreatedEvent = BaseEvent<VisitCreatedPayload>;

export const VISIT_CREATED_EVENT_NAME = 'visit.created';
export const VISIT_CREATED_EVENT_VERSION = '1.0.0';
