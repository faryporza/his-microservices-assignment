/**
 * Common building blocks for cross-service domain events.
 *
 * Every event published to the `his.events` exchange carries metadata that lets
 * consumers deduplicate, route, and trace messages without inspecting the
 * payload. Services communicate only through these contracts; they never share
 * entities or query each other's database.
 */

/**
 * Routing keys used by the HIS event-driven flow.
 *
 * `visit.created`       — published by OPD, consumed by EMR
 * `treatment.completed` — published by EMR, consumed by Finance
 * `invoice.paid`        — published by Finance, consumed by OPD
 */
export type EventRoutingKey =
  'visit.created' | 'treatment.completed' | 'invoice.paid';

/**
 * Envelope metadata attached to every event. Consumers must treat `eventId` as
 * the idempotency key: a duplicate `eventId` means the work was already done.
 */
export interface EventMetadata {
  /** Unique identifier for this single event occurrence (idempotency key). */
  eventId: string;

  /** Logical name of the event, e.g. `visit.created`. */
  eventName: string;

  /** Schema version of this event's payload, used for incompatible changes. */
  version: string;

  /** When the business fact occurred, in ISO-8601 (UTC). */
  occurredAt: string;

  /** Optional id linking events that belong to the same business flow. */
  correlationId?: string;

  /** Optional distributed trace propagated from the originating request. */
  traceId?: string;
}

/**
 * Base shape for a publishable domain event: metadata plus a typed payload.
 */
export interface BaseEvent<TPayload> {
  metadata: EventMetadata;
  payload: TPayload;
}
