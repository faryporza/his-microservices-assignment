import { BaseEvent } from './base-event.interface';

/**
 * Published by EMR after a medical record is persisted as `COMPLETED`.
 * Consumed by Finance to create the primary invoice for the visit.
 *
 * `treatmentCost` is carried as a string to preserve decimal precision; Finance
 * stores monetary values as PostgreSQL `decimal` and must not perform
 * floating-point arithmetic on it.
 */
export interface TreatmentCompletedPayload {
  visitId: string;
  recordId: string;
  treatmentCost: string;
}

export type TreatmentCompletedEvent = BaseEvent<TreatmentCompletedPayload>;

export const treatmentCompletedEventName = 'treatment.completed';
export const treatmentCompletedEventVersion = '1.0.0';
