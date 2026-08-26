import { BaseEvent } from './base-event.interface';

/**
 * Published by EMR after a medical record is persisted as `COMPLETED`.
 * Consumed by Finance to create the primary invoice for the visit.
 *
 * `treatmentCost` represents the final treatment charge (as specified in the HIS assignment).
 */
export interface TreatmentCompletedPayload {
  visitId: string;
  recordId: string;
  treatmentCost: number;
  patientId: string;
}

export type TreatmentCompletedEvent = BaseEvent<TreatmentCompletedPayload>;

export const treatmentCompletedEventName = 'treatment.completed';
export const treatmentCompletedEventVersion = '1.0.0';
