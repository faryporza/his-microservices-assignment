import { BaseEvent } from './base-event.interface';

/**
 * Published by OPD after a visit is persisted as `OPEN`.
 * Consumed by EMR to create a medical record stub for the visit.
 */
export interface VisitCreatedPayload {
  visitId: string;
  patientId: string;
  /** ISO-8601 timestamp of when the visit was opened. */
  timestamp: string;
}

export type VisitCreatedEvent = BaseEvent<VisitCreatedPayload>;

export const VISIT_CREATED_EVENT_NAME = 'visit.created';
export const VISIT_CREATED_EVENT_VERSION = '1.0.0';
