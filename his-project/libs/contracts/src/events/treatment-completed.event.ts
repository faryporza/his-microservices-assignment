import { BaseEvent } from './base-event.interface';

export interface TreatmentCompletedPayload {
  visitId: string;
  recordId: string;
  treatmentCost: number;
}

export type TreatmentCompletedEvent = BaseEvent<TreatmentCompletedPayload>;

export const TREATMENT_COMPLETED_EVENT_NAME = 'treatment.completed';
export const TREATMENT_COMPLETED_EVENT_VERSION = '1.0.0';
