export const RABBITMQ_EXCHANGE = 'his.events';

export const RABBITMQ_QUEUES = {
  emr: 'emr.events',
} as const;

export const RABBITMQ_ROUTING_KEYS = {
  visitCreated: 'visit.created',
} as const;
