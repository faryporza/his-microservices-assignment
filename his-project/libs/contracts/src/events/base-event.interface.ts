export interface EventMetadata {
  eventId: string;
  eventName: string;
  version: string;
  occurredAt: string;
  correlationId?: string;
}

export interface BaseEvent<TPayload> {
  metadata: EventMetadata;
  payload: TPayload;
}
