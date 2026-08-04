import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './entities/invoice.entity';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoiceEventsController } from './invoice-events.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice])],
  controllers: [InvoicesController, InvoiceEventsController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoiceModule {}
