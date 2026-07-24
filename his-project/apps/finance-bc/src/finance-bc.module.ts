import { Module } from '@nestjs/common';
import { FinanceBcController } from './finance-bc.controller';
import { FinanceBcService } from './finance-bc.service';

@Module({
  imports: [],
  controllers: [FinanceBcController],
  providers: [FinanceBcService],
})
export class FinanceBcModule {}
