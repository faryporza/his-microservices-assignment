/**
 * RabbitMQ topology constants shared across all bounded contexts.
 *
 * The exchange and all queues are durable, and messages are published as
 * persistent, so events survive a broker restart. Queues are bound to the
 * topic exchange with routing keys so each service receives only the events it
 * owns — see the event flow:
 *
 *   visit.created       → EMR
 *   treatment.completed → Finance
 *   invoice.paid        → OPD
 */

export const rabbitMqExchange = 'his.events';

export const rabbitMqQueues = {
  /** OPD publishes `visit.created` and consumes `invoice.paid`. */
  opd: 'opd.events',
  /** EMR consumes `visit.created` and publishes `treatment.completed`. */
  emr: 'emr.events',
  /** Finance consumes `treatment.completed` and publishes `invoice.paid`. */
  finance: 'finance.events',
} as const;

export const rabbitMqRoutingKeys = {
  visitCreated: 'visit.created',
  treatmentCompleted: 'treatment.completed',
  invoicePaid: 'invoice.paid',
} as const;

/**
 * Bindings from routing key to the queue whose owning service should consume
 * it. Used by each service to declare its queue-to-exchange bindings.
 */
export const rabbitMqBindings = {
  [rabbitMqRoutingKeys.visitCreated]: rabbitMqQueues.emr,
  [rabbitMqRoutingKeys.treatmentCompleted]: rabbitMqQueues.finance,
  [rabbitMqRoutingKeys.invoicePaid]: rabbitMqQueues.opd,
} as const;
