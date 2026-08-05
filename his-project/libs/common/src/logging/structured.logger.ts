import { LoggerService, LogLevel } from '@nestjs/common';
import { randomUUID } from 'crypto';

export type StandardLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface StructuredTraceContext {
  traceId?: string;
  spanId?: string;
  correlationId?: string;
}

export interface StructuredLogUser {
  id: string;
  role?: string;
}

export interface StructuredLogInput {
  message: string;
  trace?: StructuredTraceContext;
  user?: StructuredLogUser;
  context: Record<string, unknown>;
  details?: Record<string, unknown>;
  error?: unknown;
}

export interface StandardLogEntry {
  timestamp: string;
  level: StandardLogLevel;
  message: string;
  service: {
    name: string;
    version: string;
  };
  trace: {
    trace_id: string;
    span_id?: string;
    correlation_id: string;
  };
  user?: {
    id: string;
    role?: string;
  };
  context: Record<string, unknown>;
  details?: Record<string, unknown>;
}

const levelPriority: Record<StandardLogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

const sensitiveKeyPattern =
  /(?:password|passphrase|secret|token|authorization|cookie|api[_-]?key|id[_-]?card|card[_-]?number|credit[_-]?card|session)/i;

/**
 * Emits one JSON object per line using the standard observability envelope.
 * Arbitrary request bodies and raw exception messages are never serialized.
 */
export class StructuredLogger implements LoggerService {
  private enabledLevels?: Set<StandardLogLevel>;

  constructor(
    private readonly serviceName: string,
    private readonly serviceVersion: string = resolveServiceVersion(),
  ) {}

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, optionalParams);
  }

  setLogLevels(levels: LogLevel[]): void {
    this.enabledLevels = new Set(levels.map(toStandardLevel));
  }

  private write(
    level: StandardLogLevel,
    message: unknown,
    optionalParams: unknown[],
  ): void {
    if (!this.isLevelEnabled(level)) {
      return;
    }

    const input = normalizeInput(message, optionalParams);
    const traceId =
      normalizeTraceIdentifier(input.trace?.traceId) ??
      normalizeTraceIdentifier(input.trace?.correlationId) ??
      randomUUID();
    const correlationId =
      normalizeTraceIdentifier(input.trace?.correlationId) ?? traceId;
    const spanId = normalizeTraceIdentifier(input.trace?.spanId);
    const details = sanitizeRecord(input.details ?? {});

    if (input.error !== undefined) {
      details.error_type = toSafeError(input.error);
    }

    const entry: StandardLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: sanitizeText(input.message),
      service: {
        name: this.serviceName,
        version: this.serviceVersion,
      },
      trace: {
        trace_id: traceId,
        ...(spanId ? { span_id: spanId } : {}),
        correlation_id: correlationId,
      },
      ...(input.user
        ? {
            user: {
              id: sanitizeText(input.user.id),
              ...(input.user.role
                ? { role: sanitizeText(input.user.role) }
                : {}),
            },
          }
        : {}),
      context: sanitizeRecord(input.context),
      ...(Object.keys(details).length > 0 ? { details } : {}),
    };

    const line = `${JSON.stringify(entry)}\n`;
    if (level === 'error' || level === 'fatal') {
      process.stderr.write(line);
      return;
    }
    process.stdout.write(line);
  }

  private isLevelEnabled(level: StandardLogLevel): boolean {
    if (this.enabledLevels) {
      return this.enabledLevels.has(level);
    }

    const configured = normalizeLogLevel(process.env.LOG_LEVEL);
    const minimum =
      configured ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
    return levelPriority[level] >= levelPriority[minimum];
  }
}

function normalizeInput(
  message: unknown,
  optionalParams: unknown[],
): StructuredLogInput {
  if (isStructuredLogInput(message)) {
    return message;
  }

  const nestContext = [...optionalParams]
    .reverse()
    .find((value): value is string => typeof value === 'string');

  if (message instanceof Error) {
    return {
      message: 'Framework operation failed',
      context: {
        source: 'nestjs',
        ...(nestContext ? { nest_context: nestContext } : {}),
      },
      error: message,
    };
  }

  return {
    message:
      typeof message === 'string' ? message : 'Framework lifecycle event',
    context: {
      source: 'nestjs',
      ...(nestContext ? { nest_context: nestContext } : {}),
      ...(typeof message === 'string' ? {} : { payload_type: typeof message }),
    },
  };
}

function isStructuredLogInput(value: unknown): value is StructuredLogInput {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<StructuredLogInput>;
  return (
    typeof candidate.message === 'string' &&
    typeof candidate.context === 'object' &&
    candidate.context !== null
  );
}

function normalizeTraceIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 128
    ? normalized
    : undefined;
}

function normalizeLogLevel(value: unknown): StandardLogLevel | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const level = value.toLowerCase();
  if (level === 'verbose') {
    return 'debug';
  }
  if (level === 'log') {
    return 'info';
  }
  if (level in levelPriority) {
    return level as StandardLogLevel;
  }
  return undefined;
}

function toStandardLevel(level: LogLevel): StandardLogLevel {
  return normalizeLogLevel(level) ?? 'info';
}

function resolveServiceVersion(): string {
  return (
    normalizeTraceIdentifier(process.env.SERVICE_VERSION) ??
    normalizeTraceIdentifier(process.env.npm_package_version) ??
    '0.0.1'
  );
}

function sanitizeRecord(
  record: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      sensitiveKeyPattern.test(key) ? '[REDACTED]' : sanitizeValue(value),
    ]),
  );
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeText(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (typeof value === 'object' && value !== null) {
    if (value instanceof Error) {
      return toSafeError(value);
    }
    return sanitizeRecord(value as Record<string, unknown>);
  }
  return value;
}

function sanitizeText(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(
      /((?:password|passphrase|secret|token|authorization|api[_-]?key|id[_-]?card)\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      '$1[REDACTED]',
    )
    .replace(/\b\d{13,19}\b/g, '[REDACTED_NUMBER]');
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
  if (isInfrastructureError(error)) {
    return 'InfrastructureUnavailable';
  }

  if (error instanceof Error) {
    return error.constructor.name || 'Error';
  }

  return 'UnknownError';
}
