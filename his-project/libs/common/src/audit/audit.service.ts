import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditOutcome } from './entities/audit-log.entity';
import { StructuredLogger } from '../logging/structured.logger';

export interface LogAccessParams {
  actorId: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  ipAddress?: string | null;
  outcome: AuditOutcome;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new StructuredLogger('audit-service');

  constructor(
    @Optional()
    @InjectRepository(AuditLog)
    private readonly auditRepository?: Repository<AuditLog>,
  ) {}

  async logAccess(params: LogAccessParams): Promise<void> {
    try {
      if (this.auditRepository) {
        const logEntry = this.auditRepository.create({
          actor_id: params.actorId,
          actor_role: params.actorRole,
          action: params.action,
          resource_type: params.resourceType,
          resource_id: params.resourceId,
          ip_address: params.ipAddress ?? null,
          outcome: params.outcome,
          metadata: params.metadata ?? null,
        });
        await this.auditRepository.save(logEntry);
      }

      this.logger.log({
        message: 'PHI/Billing access audited',
        context: {
          action: params.action,
          actor_id: params.actorId,
          actor_role: params.actorRole,
          resource_type: params.resourceType,
          resource_id: params.resourceId,
          outcome: params.outcome,
        },
      });
    } catch (error: unknown) {
      // Non-blocking fail-safe: log structured warning without crashing calling workflow
      this.logger.warn({
        message: 'Failed to write audit log entry',
        context: {
          action: params.action,
          resource_id: params.resourceId,
        },
        error,
      });
    }
  }
}
