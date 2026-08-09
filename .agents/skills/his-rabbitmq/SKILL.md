---
name: his-rabbitmq
description: Implement or review HIS RabbitMQ event contracts, publishers, consumers, queues, acknowledgements, retries, and idempotency. Use for visit.created, treatment.completed, invoice.paid, or other cross-service messaging work in the HIS monorepo.
---

# HIS RabbitMQ Messaging

## Use the project topology

- Use the durable topic exchange `his.events`.
- Keep event contracts in `libs/contracts` and version payloads when incompatible changes are necessary.
- Use the routing keys `visit.created`, `treatment.completed`, and `invoice.paid`.
- Include `eventId`, event name, version, occurred time, and an optional correlation ID when the contract supports metadata.
- Keep architecture and contract decisions visible; document incompatible payload changes and their rollout before implementation.

## Publish only after local persistence

- Create and save the local aggregate before publishing its event.
- Publish `visit.created` after an OPD visit is `OPEN`.
- Publish `treatment.completed` only after a completed EMR record is persisted.
- Publish `invoice.paid` only after the invoice is persisted as `PAID` with `paid_at`.

## Consume defensively

- Declare durable exchanges and queues, and publish persistent messages.
- Validate an event before applying business logic.
- When `noAck` is `false`, obtain `RmqContext` and ACK the original message only after the database operation succeeds.
- NACK and requeue transient failures; do not requeue permanently invalid events.
- Make consumers idempotent: duplicate treatment events must not create another invoice, and duplicate paid events must leave a closed visit unchanged.
- Implement NestJS event handlers as singular-resource events controllers, such as `visit-events.controller.ts` and `VisitEventsController`; do not use `*.consumer.ts` for a class decorated with `@Controller()`.

## Verify a flow

1. Test publisher payload and routing key.
2. Test consumer business result, acknowledgement, and duplicate delivery.
3. Test a stopped consumer: publish the event, restart the consumer, and confirm delivery completes.
4. Update event documentation and the runnable Postman flow when externally observable behavior changes.
