export const RABBITMQ_EXCHANGE = 'his.events';

export const RABBITMQ_QUEUES = {
  opd: 'opd.events',
} as const;

export const RABBITMQ_ROUTING_KEYS = {
  invoicePaid: 'invoice.paid',
} as const;
