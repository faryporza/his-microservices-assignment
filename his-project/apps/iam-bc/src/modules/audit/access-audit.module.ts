import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '@app/common';
import { AccessAuditEventsController } from './access-audit-events.controller';
import { AccessAuditEventsService } from './access-audit-events.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AccessAuditEventsController],
  providers: [AccessAuditEventsService],
})
export class AccessAuditModule {}
