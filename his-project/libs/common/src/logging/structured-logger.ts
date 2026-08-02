import { HttpException } from '@nestjs/common';
import { Logger } from '@nestjs/common';

export type LogStatus = number | string;

export interface StructuredLogContext {
  eventName?: string;
  eventId?: string;
  correlationId?: string;
  visitId?: string;
  status?: LogStatus;
  error?: unknown;
}

/**
 * Writes a deliberately small, JSON log envelope.
 *
 * Only identifiers and operation metadata are accepted here. Callers must not
 * pass request bodies, tokens, patient entities, or event payloads.
 */
export class StructuredLogger {
  private readonly logger: Logger;

  constructor(private readonly service: string) {
    this.logger = new Logger(service);
  }

  log(context: StructuredLogContext): void {
    this.logger.log(this.serialize(context));
  }

  error(context: StructuredLogContext): void {
    this.logger.error(this.serialize(context));
  }

  private serialize(context: StructuredLogContext): string {
    return JSON.stringify({
      service: this.service,
      eventName: context.eventName ?? null,
      eventId: context.eventId ?? null,
      correlationId: context.correlationId ?? null,
      visitId: context.visitId ?? null,
      status: context.status ?? 'INFO',
      timestamp: new Date().toISOString(),
      error: context.error === undefined ? null : toSafeError(context.error),
    });
  }
}

/**
 * Classifies infrastructure failures without logging the original driver
 * message, which may contain SQL, connection details, or query parameters.
 */
export function isInfrastructureError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as {
    code?: unknown;
    name?: unknown;
    message?: unknown;
  };
  const code = typeof candidate.code === 'string' ? candidate.code : '';
  const name = typeof candidate.name === 'string' ? candidate.name : '';
  const message =
    typeof candidate.message === 'string' ? candidate.message : '';

  if (
    ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', '57P01', '08000'].includes(code)
  ) {
    return true;
  }

  return /(?:typeorm|queryrunner|postgres|database|rabbitmq|amqp|broker|connection refused|channel closed|socket hang up)/i.test(
    `${name} ${message}`,
  );
}

export function toSafeError(error: unknown): string {
  if (error instanceof HttpException) {
    return error.constructor.name;
  }

  if (isInfrastructureError(error)) {
    return 'InfrastructureUnavailable';
  }

  if (error instanceof Error) {
    return error.constructor.name || 'Error';
  }

  return 'UnknownError';
}
