import { BaseEvent } from './base-event.interface';

export interface InvoicePaidPayload {
  visitId: string;
  invoiceId: string;
  status: 'PAID';
}

export type InvoicePaidEvent = BaseEvent<InvoicePaidPayload>;

export const INVOICE_PAID_EVENT_NAME = 'invoice.paid';
export const INVOICE_PAID_EVENT_VERSION = '1.0.0';
