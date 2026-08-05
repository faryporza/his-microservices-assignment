import { BaseEvent } from './base-event.interface';

/**
 * Published by Finance after an invoice is persisted as `PAID` with `paidAt`.
 * Consumed by OPD to close the visit. Receiving a duplicate `invoice.paid`
 * event for a visit that is already `CLOSED` must leave it closed.
 */
export interface InvoicePaidPayload {
  visitId: string;
  invoiceId: string;
  status: 'PAID';
}

export type InvoicePaidEvent = BaseEvent<InvoicePaidPayload>;

export const invoicePaidEventName = 'invoice.paid';
export const invoicePaidEventVersion = '1.0.0';
