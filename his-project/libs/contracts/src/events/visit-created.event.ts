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

export const visitCreatedEventName = 'visit.created';
export const visitCreatedEventVersion = '1.0.0';
