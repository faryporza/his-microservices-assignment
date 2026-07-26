import { Module } from '@nestjs/common';
import { CommonService } from './common.service';
import { RmqService } from './rmq/rmq.service';

@Module({
  providers: [CommonService, RmqService],
  exports: [CommonService, RmqService],
})
export class CommonModule {}
