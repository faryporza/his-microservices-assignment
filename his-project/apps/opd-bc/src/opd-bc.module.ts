import { Module } from '@nestjs/common';
import { OpdBcController } from './opd-bc.controller';
import { OpdBcService } from './opd-bc.service';

@Module({
  imports: [],
  controllers: [OpdBcController],
  providers: [OpdBcService],
})
export class OpdBcModule {}
