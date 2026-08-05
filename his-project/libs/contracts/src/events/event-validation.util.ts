import { EventMetadata } from './base-event.interface';

const uuidV4Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidV4(value: unknown): value is string {
  return typeof value === 'string' && uuidV4Pattern.test(value);
}

export function getEventIdForLog(event: unknown): string {
  if (typeof event !== 'object' || event === null) {
    return 'unknown';
  }

  const metadata = (event as { metadata?: unknown }).metadata;
  if (typeof metadata !== 'object' || metadata === null) {
    return 'unknown';
  }

  const eventId = (metadata as { eventId?: unknown }).eventId;
  return isUuidV4(eventId) ? eventId : 'unknown';
}

export function hasValidEventMetadata(
  value: unknown,
  eventName: string,
  version: string,
): value is EventMetadata {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const metadata = value as Partial<EventMetadata>;
  return (
    isUuidV4(metadata.eventId) &&
    metadata.eventName === eventName &&
    metadata.version === version &&
    typeof metadata.occurredAt === 'string' &&
    !Number.isNaN(Date.parse(metadata.occurredAt)) &&
    isOptionalTraceIdentifier(metadata.correlationId) &&
    isOptionalTraceIdentifier(metadata.traceId)
  );
}

function isOptionalTraceIdentifier(value: unknown): boolean {
  return (
    value === undefined ||
    (typeof value === 'string' &&
      value.trim().length > 0 &&
      value.length <= 128)
  );
}
