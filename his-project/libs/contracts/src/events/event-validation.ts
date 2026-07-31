import { EventMetadata } from './base-event.interface';

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidV4(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4_PATTERN.test(value);
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
    !Number.isNaN(Date.parse(metadata.occurredAt))
  );
}
