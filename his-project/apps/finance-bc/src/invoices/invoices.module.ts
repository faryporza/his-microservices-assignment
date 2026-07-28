import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './entities/invoice.entity';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoicesConsumer } from './invoices.consumer';
import { ProcessedEvent } from '../messaging/entities/processed-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, ProcessedEvent])],
  controllers: [InvoicesController, InvoicesConsumer],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
