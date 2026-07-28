export const RABBITMQ_EXCHANGE = 'his.events';

export const RABBITMQ_QUEUES = {
  finance: 'finance.events',
} as const;

export const RABBITMQ_ROUTING_KEYS = {
  treatmentCompleted: 'treatment.completed',
} as const;
