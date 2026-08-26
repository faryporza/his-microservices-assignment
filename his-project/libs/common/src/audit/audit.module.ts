import { Global, Module } from '@nestjs/common';
import { CommonModule } from '../common.module';
import { AuditService } from './audit.service';

@Global()
@Module({
  imports: [CommonModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
