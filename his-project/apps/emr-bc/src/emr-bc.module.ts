import { Module } from '@nestjs/common';
import { EmrBcController } from './emr-bc.controller';
import { EmrBcService } from './emr-bc.service';

@Module({
  imports: [],
  controllers: [EmrBcController],
  providers: [EmrBcService],
})
export class EmrBcModule {}
